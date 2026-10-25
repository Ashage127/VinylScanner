import express from "express";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

console.log("BACKEND VERSION: PRESSING-CONDITION-V2");

app.use(cors());
app.use(express.json());

// ======================================================
// UPLOAD
// ======================================================

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 10 * 1024 * 1024,
  },

  fileFilter(req, file, callback) {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowed.includes(file.mimetype)) {
      callback(
        new Error(
          "Only JPEG, PNG and WebP images are supported."
        )
      );

      return;
    }

    callback(null, true);
  },
});

// ======================================================
// HELPERS
// ======================================================

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeIdentifier(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeBarcode(value = "") {
  return String(value)
    .replace(/[^0-9]/g, "")
    .trim();
}

function importantWords(value = "") {
  const ignored = new Set([
    "the",
    "a",
    "an",
    "and",
    "of",
    "to",
    "in",
    "on",
    "for",
  ]);

  return normalizeText(value)
    .split(" ")
    .filter(
      (word) =>
        word.length > 1 &&
        !ignored.has(word)
    );
}

function uniqueStrings(values = []) {
  return [
    ...new Set(
      values
        .map((value) =>
          String(value || "").trim()
        )
        .filter(Boolean)
    ),
  ];
}

function roundPrice(value) {
  return Math.round(value * 100) / 100;
}

function percentile(values, p) {
  if (!values.length) {
    return null;
  }

  const sorted = [...values].sort(
    (a, b) => a - b
  );

  if (sorted.length === 1) {
    return sorted[0];
  }

  const index =
    (sorted.length - 1) * p;

  const lower =
    Math.floor(index);

  const upper =
    Math.ceil(index);

  if (lower === upper) {
    return sorted[lower];
  }

  const weight =
    index - lower;

  return (
    sorted[lower] * (1 - weight) +
    sorted[upper] * weight
  );
}

// ======================================================
// FUZZY MATCH
// ======================================================

function levenshteinDistance(a, b) {
  const first =
    normalizeText(a);

  const second =
    normalizeText(b);

  if (!first.length) {
    return second.length;
  }

  if (!second.length) {
    return first.length;
  }

  const matrix = [];

  for (
    let i = 0;
    i <= second.length;
    i++
  ) {
    matrix[i] = [i];
  }

  for (
    let j = 0;
    j <= first.length;
    j++
  ) {
    matrix[0][j] = j;
  }

  for (
    let i = 1;
    i <= second.length;
    i++
  ) {
    for (
      let j = 1;
      j <= first.length;
      j++
    ) {
      if (
        second[i - 1] ===
        first[j - 1]
      ) {
        matrix[i][j] =
          matrix[i - 1][j - 1];
      } else {
        matrix[i][j] =
          Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
      }
    }
  }

  return matrix[
    second.length
  ][first.length];
}

function stringSimilarity(a, b) {
  const first =
    normalizeText(a);

  const second =
    normalizeText(b);

  if (!first || !second) {
    return 0;
  }

  if (first === second) {
    return 1;
  }

  const distance =
    levenshteinDistance(
      first,
      second
    );

  const longest =
    Math.max(
      first.length,
      second.length
    );

  return Math.max(
    0,
    1 - distance / longest
  );
}

function fuzzyTextSimilarity(
  input,
  candidate
) {
  const first =
    normalizeText(input);

  const second =
    normalizeText(candidate);

  if (!first || !second) {
    return 0;
  }

  if (first === second) {
    return 1;
  }

  if (
    first.includes(second) ||
    second.includes(first)
  ) {
    return 0.95;
  }

  const full =
    stringSimilarity(
      first,
      second
    );

  const inputWords =
    importantWords(first);

  const candidateWords =
    importantWords(second);

  if (
    !inputWords.length ||
    !candidateWords.length
  ) {
    return full;
  }

  let total = 0;

  for (const inputWord of inputWords) {
    let best = 0;

    for (
      const candidateWord
      of candidateWords
    ) {
      best =
        Math.max(
          best,
          stringSimilarity(
            inputWord,
            candidateWord
          )
        );
    }

    total += best;
  }

  const wordScore =
    total /
    inputWords.length;

  return Math.max(
    full,
    wordScore * 0.72 +
      full * 0.28
  );
}

// ======================================================
// FETCH
// ======================================================

async function fetchJson(
  url,
  options = {},
  timeout = 20000
) {
  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () =>
        controller.abort(),
      timeout
    );

  try {
    const response =
      await fetch(url, {
        ...options,
        signal:
          controller.signal,
      });

    const raw =
      await response.text();

    let data = {};

    try {
      data =
        raw
          ? JSON.parse(raw)
          : {};
    } catch {
      throw new Error(
        `External service returned invalid data (${response.status}).`
      );
    }

    if (!response.ok) {
      throw new Error(
        data?.message ||
          data?.error?.message ||
          data?.errors?.[0]?.message ||
          `Request failed (${response.status}).`
      );
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
}

// ======================================================
// TEST
// ======================================================

app.get(
  "/api/test",
  (req, res) => {
    res.json({
      success: true,
      version:
        "PRESSING-CONDITION-V2",
    });
  }
);

// ======================================================
// GROQ COVER
// ======================================================

async function identifyWithGroq(
  file
) {
  if (
    !process.env.GROQ_API_KEY
  ) {
    throw new Error(
      "GROQ_API_KEY is missing."
    );
  }

  const base64 =
    file.buffer.toString(
      "base64"
    );

  const dataUrl =
    `data:${file.mimetype};base64,${base64}`;

  const data =
    await fetchJson(
      "https://api.groq.com/openai/v1/chat/completions",

      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${process.env.GROQ_API_KEY}`,

          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          model:
            "qwen/qwen3.8-27b",

          temperature: 0,

          messages: [
            {
              role: "user",

              content: [
                {
                  type: "text",

                  text: `
Identify the music album shown on this front cover.

Return JSON only:

{
  "identified": true,
  "artist": "Artist",
  "album": "Album"
}

If uncertain:

{
  "identified": false,
  "artist": null,
  "album": null
}
                  `.trim(),
                },

                {
                  type:
                    "image_url",

                  image_url: {
                    url: dataUrl,
                  },
                },
              ],
            },
          ],
        }),
      },

      30000
    );

  const content =
    String(
      data?.choices?.[0]
        ?.message?.content ||
        ""
    )
      .replace(
        /```json/gi,
        ""
      )
      .replace(
        /```/g,
        ""
      )
      .trim();

  const start =
    content.indexOf("{");

  const end =
    content.lastIndexOf("}");

  if (
    start === -1 ||
    end === -1
  ) {
    throw new Error(
      "Could not parse Groq response."
    );
  }

  return JSON.parse(
    content.slice(
      start,
      end + 1
    )
  );
}

// ======================================================
// GROQ MANUAL CORRECTION
// ======================================================

async function correctManualSearchWithGroq(
  artist,
  album
) {
  if (
    !process.env.GROQ_API_KEY
  ) {
    return {
      artist,
      album,
    };
  }

  try {
    const data =
      await fetchJson(
        "https://api.groq.com/openai/v1/chat/completions",

        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${process.env.GROQ_API_KEY}`,

            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            model:
              "qwen/qwen3.8-27b",

            temperature: 0,

            messages: [
              {
                role: "system",

                content: `
Correct obvious spelling mistakes in a music album search.
Keep the intended record.
Return JSON only:

{
  "artist": "",
  "album": ""
}
                `.trim(),
              },

              {
                role: "user",

                content:
                  JSON.stringify({
                    artist,
                    album,
                  }),
              },
            ],
          }),
        },

        15000
      );

    const content =
      String(
        data?.choices?.[0]
          ?.message?.content ||
          ""
      )
        .replace(
          /```json/gi,
          ""
        )
        .replace(
          /```/g,
          ""
        )
        .trim();

    const start =
      content.indexOf("{");

    const end =
      content.lastIndexOf("}");

    if (
      start === -1 ||
      end === -1
    ) {
      return {
        artist,
        album,
      };
    }

    const parsed =
      JSON.parse(
        content.slice(
          start,
          end + 1
        )
      );

    return {
      artist:
        String(
          parsed.artist ||
            artist ||
            ""
        ).trim(),

      album:
        String(
          parsed.album ||
            album ||
            ""
        ).trim(),
    };
  } catch (error) {
    console.log(
      "Correction failed:",
      error.message
    );

    return {
      artist,
      album,
    };
  }
}

// ======================================================
// DISCOGS
// ======================================================

function discogsAuthParams() {
  const params =
    new URLSearchParams();

  if (
    process.env
      .DISCOGS_CONSUMER_KEY
  ) {
    params.set(
      "key",
      process.env
        .DISCOGS_CONSUMER_KEY
    );
  }

  if (
    process.env
      .DISCOGS_CONSUMER_SECRET
  ) {
    params.set(
      "secret",
      process.env
        .DISCOGS_CONSUMER_SECRET
    );
  }

  return params;
}

async function discogsRequest(
  url
) {
  return fetchJson(
    url,
    {
      headers: {
        "User-Agent":
          "VinylScanner/1.0",
      },
    },
    20000
  );
}

function parseDiscogsTitle(
  title = ""
) {
  const index =
    title.indexOf(" - ");

  if (index === -1) {
    return {
      artist: "",
      album: title,
    };
  }

  return {
    artist:
      title
        .slice(0, index)
        .trim(),

    album:
      title
        .slice(index + 3)
        .trim(),
  };
}

async function discogsSearch({
  artist = "",
  album = "",
  barcode = "",
  catno = "",
  q = "",
  perPage = 100,
}) {
  const params =
    discogsAuthParams();

  params.set(
    "type",
    "release"
  );

  params.set(
    "format",
    "Vinyl"
  );

  params.set(
    "per_page",
    String(perPage)
  );

  if (artist) {
    params.set(
      "artist",
      artist
    );
  }

  if (album) {
    params.set(
      "release_title",
      album
    );
  }

  if (barcode) {
    params.set(
      "barcode",
      normalizeBarcode(
        barcode
      )
    );
  }

  if (catno) {
    params.set(
      "catno",
      catno
    );
  }

  if (q) {
    params.set(
      "q",
      q
    );
  }

  const data =
    await discogsRequest(
      `https://api.discogs.com/database/search?${params.toString()}`
    );

  return Array.isArray(
    data.results
  )
    ? data.results
    : [];
}

function getIdentifiers(
  details,
  type
) {
  const identifiers =
    Array.isArray(
      details.identifiers
    )
      ? details.identifiers
      : [];

  return identifiers
    .filter((item) => {
      const current =
        normalizeText(
          item.type || ""
        );

      if (
        type === "barcode"
      ) {
        return (
          current ===
          "barcode"
        );
      }

      if (
        type === "matrix"
      ) {
        return (
          current.includes(
            "matrix"
          ) ||
          current.includes(
            "runout"
          )
        );
      }

      return false;
    })
    .map((item) =>
      String(
        item.value || ""
      ).trim()
    )
    .filter(Boolean);
}

async function getDiscogsDetails(
  selected
) {
  const params =
    discogsAuthParams();

  const details =
    await discogsRequest(
      `https://api.discogs.com/releases/${selected.id}?${params.toString()}`
    );

  const artist =
    Array.isArray(
      details.artists
    )
      ? details.artists
          .map(
            (item) =>
              item.name
          )
          .join(", ")
      : null;

  const labels =
    Array.isArray(
      details.labels
    )
      ? details.labels
      : [];

  const coverImage =
    details.images?.[0]
      ?.uri ||
    details.images?.[0]
      ?.uri150 ||
    selected.cover_image ||
    selected.thumb ||
    null;

  return {
    artist,

    album:
      details.title ||
      null,

    year:
      details.year ||
      selected.year ||
      null,

    country:
      details.country ||
      selected.country ||
      null,

    genres:
      details.genres ||
      [],

    styles:
      details.styles ||
      [],

    labels:
      uniqueStrings(
        labels.map(
          (item) =>
            item.name
        )
      ),

    catnos:
      uniqueStrings(
        labels
          .map(
            (item) =>
              item.catno
          )
          .filter(
            (value) =>
              value &&
              normalizeText(
                value
              ) !==
                "none"
          )
      ),

    barcodes:
      uniqueStrings(
        getIdentifiers(
          details,
          "barcode"
        )
      ),

    matrixRunouts:
      uniqueStrings(
        getIdentifiers(
          details,
          "matrix"
        )
      ),

    coverImage,

    discogsUrl:
      details.uri ||
      `https://www.discogs.com/release/${selected.id}`,

    releaseId:
      selected.id,

    masterId:
      selected.master_id ||
      details.master_id ||
      null,
  };
}

function candidateScore(
  item,
  artist,
  album
) {
  const parsed =
    parseDiscogsTitle(
      item.title || ""
    );

  const albumScore =
    fuzzyTextSimilarity(
      album,
      parsed.album ||
        item.title ||
        ""
    );

  const artistScore =
    artist
      ? fuzzyTextSimilarity(
          artist,
          parsed.artist ||
            item.title ||
            ""
        )
      : 1;

  let score =
    albumScore * 70 +
    artistScore * 30;

  if (
    Array.isArray(
      item.format
    ) &&
    item.format.some(
      (format) =>
        normalizeText(
          format
        ).includes(
          "vinyl"
        )
    )
  ) {
    score += 4;
  }

  return {
    score,
    albumScore,
    artistScore,
  };
}

async function pickBestDiscogsResult(
  results,
  artist,
  album
) {
  const scored =
    results
      .map((item) => ({
        item,
        ...candidateScore(
          item,
          artist,
          album
        ),
      }))
      .filter(
        (entry) =>
          entry.albumScore >=
            0.52 &&
          (!artist ||
            entry.artistScore >=
              0.45)
      )
      .sort(
        (a, b) =>
          b.score -
          a.score
      );

  if (!scored.length) {
    return null;
  }

  console.log(
    "Discogs selected:",
    scored[0].item.title,
    scored[0].score.toFixed(
      1
    )
  );

  return getDiscogsDetails(
    scored[0].item
  );
}

async function searchDiscogs(
  artist,
  album
) {
  let results =
    await discogsSearch({
      artist,
      album,
    });

  let result =
    await pickBestDiscogsResult(
      results,
      artist,
      album
    );

  if (result) {
    return result;
  }

  results =
    await discogsSearch({
      q:
        `${artist} ${album}`.trim(),
    });

  return pickBestDiscogsResult(
    results,
    artist,
    album
  );
}

async function searchDiscogsManual(
  artist,
  album
) {
  const first =
    await searchDiscogs(
      artist,
      album
    );

  if (first) {
    return first;
  }

  const corrected =
    await correctManualSearchWithGroq(
      artist,
      album
    );

  return searchDiscogs(
    corrected.artist,
    corrected.album
  );
}

// ======================================================
// BARCODE
// ======================================================

async function searchBarcode(
  barcode
) {
  const normalized =
    normalizeBarcode(
      barcode
    );

  let results =
    await discogsSearch({
      barcode:
        normalized,
    });

  if (!results.length) {
    results =
      await discogsSearch({
        q:
          normalized,
      });
  }

  if (!results.length) {
    return null;
  }

  const detailed = [];

  for (
    const item
    of results.slice(0, 12)
  ) {
    try {
      detailed.push(
        await getDiscogsDetails(
          item
        )
      );
    } catch (error) {
      console.log(
        "Barcode detail:",
        error.message
      );
    }
  }

  if (!detailed.length) {
    return null;
  }

  const exact =
    detailed.filter(
      (item) =>
        item.barcodes.some(
          (value) =>
            normalizeBarcode(
              value
            ) ===
            normalized
        )
    );

  const pool =
    exact.length
      ? exact
      : detailed;

  return {
    ...pool[0],

    candidateCount:
      pool.length,

    pressingMatch: {
      level:
        pool.length === 1
          ? "likely"
          : "barcode",

      reason:
        pool.length === 1
          ? "Barcode matched one Discogs vinyl release. Matrix/runout can confirm it more strongly."
          : `Barcode matches ${pool.length} possible vinyl releases.`,
    },
  };
}

// ======================================================
// EXACT PRESSING
// ======================================================

function identifierMatches(
  detail,
  {
    barcode,
    catno,
    matrix,
  }
) {
  const wantedBarcode =
    normalizeBarcode(
      barcode
    );

  const wantedCatno =
    normalizeIdentifier(
      catno
    );

  const wantedMatrix =
    normalizeIdentifier(
      matrix
    );

  return {
    barcodeMatch:
      !wantedBarcode ||
      detail.barcodes.some(
        (value) =>
          normalizeBarcode(
            value
          ) ===
          wantedBarcode
      ),

    catnoMatch:
      !wantedCatno ||
      detail.catnos.some(
        (value) => {
          const current =
            normalizeIdentifier(
              value
            );

          return (
            current ===
              wantedCatno ||
            current.includes(
              wantedCatno
            ) ||
            wantedCatno.includes(
              current
            )
          );
        }
      ),

    matrixMatch:
      !wantedMatrix ||
      detail.matrixRunouts.some(
        (value) => {
          const current =
            normalizeIdentifier(
              value
            );

          return (
            current ===
              wantedMatrix ||
            current.includes(
              wantedMatrix
            ) ||
            wantedMatrix.includes(
              current
            )
          );
        }
      ),
  };
}

async function findExactPressing({
  artist,
  album,
  barcode,
  catno,
  matrix,
}) {
  let results = [];

  if (barcode) {
    results =
      await discogsSearch({
        barcode,
      });
  }

  if (
    !results.length &&
    catno
  ) {
    results =
      await discogsSearch({
        artist,
        album,
        catno,
      });
  }

  if (!results.length) {
    results =
      await discogsSearch({
        artist,
        album,
      });
  }

  const matches = [];

  for (
    const item
    of results.slice(0, 20)
  ) {
    try {
      const detail =
        await getDiscogsDetails(
          item
        );

      const albumScore =
        fuzzyTextSimilarity(
          album,
          detail.album
        );

      const artistScore =
        artist
          ? fuzzyTextSimilarity(
              artist,
              detail.artist
            )
          : 1;

      if (
        albumScore < 0.5 ||
        artistScore < 0.45
      ) {
        continue;
      }

      const identifiers =
        identifierMatches(
          detail,
          {
            barcode,
            catno,
            matrix,
          }
        );

      if (
        barcode &&
        !identifiers.barcodeMatch
      ) {
        continue;
      }

      if (
        catno &&
        !identifiers.catnoMatch
      ) {
        continue;
      }

      if (
        matrix &&
        !identifiers.matrixMatch
      ) {
        continue;
      }

      let score =
        albumScore * 40 +
        artistScore * 20;

      if (
        barcode &&
        identifiers.barcodeMatch
      ) {
        score += 30;
      }

      if (
        catno &&
        identifiers.catnoMatch
      ) {
        score += 40;
      }

      if (
        matrix &&
        identifiers.matrixMatch
      ) {
        score += 100;
      }

      matches.push({
        detail,
        score,
        identifiers,
      });
    } catch (error) {
      console.log(
        "Pressing detail:",
        error.message
      );
    }
  }

  matches.sort(
    (a, b) =>
      b.score -
      a.score
  );

  if (!matches.length) {
    return null;
  }

  const best =
    matches[0];

  let level =
    "likely";

  let reason =
    "Best matching release based on the identifiers provided.";

  if (
    matrix &&
    best.identifiers
      .matrixMatch
  ) {
    level =
      "exact";

    reason =
      "Matrix/runout matched this Discogs release.";
  } else if (
    barcode &&
    catno &&
    best.identifiers
      .barcodeMatch &&
    best.identifiers
      .catnoMatch
  ) {
    level =
      "likely";

    reason =
      "Barcode and catalog number matched this release.";
  } else if (
    barcode
  ) {
    level =
      "barcode";

    reason =
      "Barcode matched this release. Matrix/runout gives stronger confirmation.";
  }

  return {
    ...best.detail,

    candidateCount:
      matches.length,

    pressingMatch: {
      level,
      reason,
    },
  };
}

// ======================================================
// EBAY TOKEN
// ======================================================

let ebayTokenCache = {
  token: null,
  expiresAt: 0,
};

async function getEbayToken() {
  const now =
    Date.now();

  if (
    ebayTokenCache.token &&
    now <
      ebayTokenCache.expiresAt -
        60000
  ) {
    return ebayTokenCache.token;
  }

  const clientId =
    process.env
      .EBAY_CLIENT_ID;

  const clientSecret =
    process.env
      .EBAY_CLIENT_SECRET;

  if (
    !clientId ||
    !clientSecret
  ) {
    throw new Error(
      "eBay credentials are missing."
    );
  }

  const basic =
    Buffer.from(
      `${clientId}:${clientSecret}`
    ).toString(
      "base64"
    );

  const body =
    new URLSearchParams();

  body.set(
    "grant_type",
    "client_credentials"
  );

  body.set(
    "scope",
    "https://api.ebay.com/oauth/api_scope"
  );

  const data =
    await fetchJson(
      "https://api.ebay.com/identity/v1/oauth2/token",

      {
        method: "POST",

        headers: {
          Authorization:
            `Basic ${basic}`,

          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          body.toString(),
      }
    );

  ebayTokenCache = {
    token:
      data.access_token,

    expiresAt:
      now +
      Number(
        data.expires_in ||
          7200
      ) *
        1000,
  };

  return data.access_token;
}

// ======================================================
// EBAY BASIC MATCH
// ======================================================

function isFixedPriceListing(
  item
) {
  if (
    !Array.isArray(
      item.buyingOptions
    ) ||
    !item.buyingOptions.length
  ) {
    return true;
  }

  return item.buyingOptions.some(
    (option) =>
      option ===
        "FIXED_PRICE" ||
      option ===
        "BEST_OFFER"
  );
}

function ebayListingMatches(
  item,
  artist,
  album
) {
  const title =
    normalizeText(
      item.title || ""
    );

  const artistWords =
    importantWords(
      artist
    );

  const albumWords =
    importantWords(
      album
    );

  if (
    artistWords.length &&
    !artistWords.every(
      (word) =>
        title.includes(
          word
        )
    )
  ) {
    return false;
  }

  if (
    albumWords.length
  ) {
    const matching =
      albumWords.filter(
        (word) =>
          title.includes(
            word
          )
      ).length;

    if (
      matching /
        albumWords.length <
      0.7
    ) {
      return false;
    }
  }

  const padded =
    ` ${title} `;

  const wrongFormats = [
    " cd ",
    " cassette ",
    " dvd ",
    " blu ray ",
    " bluray ",
    " tape ",
  ];

  if (
    wrongFormats.some(
      (word) =>
        padded.includes(
          word
        )
    )
  ) {
    return false;
  }

  const excluded = [
    "box set",
    "signed",
    "autographed",
    "test pressing",
    "picture disc",
    "mfsl",
    "mobile fidelity",
    "uhqr",
  ];

  if (
    excluded.some(
      (word) =>
        title.includes(
          word
        )
    )
  ) {
    return false;
  }

  return (
    title.includes(
      "vinyl"
    ) ||
    /\blp\b/.test(
      title
    ) ||
    title.includes(
      "record"
    )
  );
}

async function ebaySearch(
  query,
  token,
  marketplace
) {
  const params =
    new URLSearchParams();

  params.set(
    "q",
    query
  );

  params.set(
    "limit",
    "100"
  );

  const data =
    await fetchJson(
      `https://api.ebay.com/buy/browse/v1/item_summary/search?${params.toString()}`,

      {
        headers: {
          Authorization:
            `Bearer ${token}`,

          "X-EBAY-C-MARKETPLACE-ID":
            marketplace,
        },
      }
    );

  return Array.isArray(
    data.itemSummaries
  )
    ? data.itemSummaries
    : [];
}

async function searchEbaySummaries(
  artist,
  album,
  extraQueries = []
) {
  const token =
    await getEbayToken();

  const marketplace =
    process.env
      .EBAY_MARKETPLACE_ID ||
    "EBAY_US";

  const queries =
    uniqueStrings([
      ...extraQueries,

      `${artist} ${album} vinyl`,

      `${artist} ${album} LP`,

      `"${artist}" "${album}" vinyl record`,
    ]);

  const all = [];

  for (
    const query
    of queries
  ) {
    try {
      console.log(
        "Searching eBay:",
        query
      );

      const results =
        await ebaySearch(
          query,
          token,
          marketplace
        );

      all.push(
        ...results
      );
    } catch (error) {
      console.log(
        "eBay search:",
        error.message
      );
    }
  }

  const unique =
    new Map();

  for (
    const item
    of all
  ) {
    const key =
      item.itemId ||
      item.itemWebUrl ||
      `${item.title}-${item.price?.value}`;

    if (
      !unique.has(key)
    ) {
      unique.set(
        key,
        item
      );
    }
  }

  const items =
    [...unique.values()]
      .filter(
        (item) =>
          ebayListingMatches(
            item,
            artist,
            album
          )
      )
      .filter(
        isFixedPriceListing
      );

  console.log(
    "Normal vinyl listings:",
    items.length
  );

  return {
    token,
    marketplace,
    items,
  };
}

// ======================================================
// NORMAL PRICE
// ======================================================

function selectCommonPriceCluster(
  prices
) {
  if (
    prices.length <= 3
  ) {
    return [...prices];
  }

  const sorted =
    [...prices].sort(
      (a, b) =>
        a - b
    );

  let best = [];

  for (
    let start = 0;
    start <
    sorted.length;
    start++
  ) {
    const minimum =
      sorted[start];

    const cluster =
      [];

    for (
      let i = start;
      i <
      sorted.length;
      i++
    ) {
      if (
        sorted[i] <=
        minimum * 1.7
      ) {
        cluster.push(
          sorted[i]
        );
      } else {
        break;
      }
    }

    if (
      cluster.length >
      best.length
    ) {
      best =
        cluster;
    }
  }

  return best;
}

function calculatePriceEstimate(items) {
  const prices = items
    .filter((item) => item.price?.currency === "USD")
    .map((item) => Number(item.price.value))
    .filter(
      (price) =>
        Number.isFinite(price) &&
        price >= 3 &&
        price <= 1000
    );

  if (prices.length < 3) {
    return null;
  }

  const cluster = selectCommonPriceCluster(prices);

  const q1 = percentile(cluster, 0.25);
  const q3 = percentile(cluster, 0.75);
  const iqr = q3 - q1;

  const cleaned = cluster.filter(
    (price) =>
      price >= q1 - iqr * 1.5 &&
      price <= q3 + iqr * 1.5
  );

  const finalPrices =
    cleaned.length >= 3 ? cleaned : cluster;

  return {
    currency: "USD",

    estimatedPrice: roundPrice(
      percentile(finalPrices, 0.5)
    ),

    typicalLow: roundPrice(
      percentile(finalPrices, 0.25)
    ),

    typicalHigh: roundPrice(
      percentile(finalPrices, 0.75)
    ),

    listingsUsed: finalPrices.length,

    outliersRemoved:
      prices.length - finalPrices.length,

    totalPriceResults: prices.length,
  };
}

async function searchEbayPrices(
  artist,
  album
) {
  if (
    !artist ||
    !album
  ) {
    return null;
  }

  const search =
    await searchEbaySummaries(
      artist,
      album
    );

  const result =
    calculatePriceEstimate(
      search.items
    );

  console.log(
    "Market price:",
    result
  );

  return result;
}

// ======================================================
// DETAILED EBAY LISTINGS
// ======================================================

async function getEbayItemDetail(
  itemId,
  token,
  marketplace
) {
  return fetchJson(
    `https://api.ebay.com/buy/browse/v1/item/${encodeURIComponent(
      itemId
    )}`,

    {
      headers: {
        Authorization:
          `Bearer ${token}`,

        "X-EBAY-C-MARKETPLACE-ID":
          marketplace,
      },
    }
  );
}

function getItemAspects(
  item
) {
  return Array.isArray(
    item.localizedAspects
  )
    ? item.localizedAspects
    : [];
}

function listingText(
  item
) {
  const aspects =
    getItemAspects(
      item
    )
      .map(
        (aspect) =>
          `${aspect.name || ""} ${aspect.value || ""}`
      )
      .join(" ");

  return [
    item.title,
    item.subtitle,
    item.shortDescription,
    item.gtin,
    item.mpn,
    item.brand,
    aspects,
  ]
    .filter(Boolean)
    .join(" ");
}

// ======================================================
// GRADING
// ======================================================

const ALLOWED_GRADES =
  new Set([
    "M",
    "NM",
    "VG+",
    "VG",
    "G+",
    "G",
  ]);

const GRADE_RANK = {
  G: 0,
  "G+": 1,
  VG: 2,
  "VG+": 3,
  NM: 4,
  M: 5,
};

function normalizeGrade(
  value
) {
  if (!value) {
    return null;
  }

  let text =
    String(value)
      .toUpperCase()
      .trim();

  text =
    text
      .replace(
        /NEAR MINT/g,
        "NM"
      )
      .replace(
        /NM-/g,
        "NM"
      )
      .replace(
        /MINT MINUS/g,
        "NM"
      )
      .replace(
        /VERY GOOD PLUS/g,
        "VG+"
      )
      .replace(
        /VERY GOOD \+/g,
        "VG+"
      )
      .replace(
        /GOOD PLUS/g,
        "G+"
      );

  // Seller may use EX / Excellent.
  // Our app does NOT have an EX grade,
  // so treat it as the nearest supported grade.
  text =
    text
      .replace(
        /EXCELLENT PLUS/g,
        "VG+"
      )
      .replace(
        /EXCELLENT/g,
        "VG+"
      )
      .replace(
        /\bEX\+\b/g,
        "VG+"
      )
      .replace(
        /\bEX\b/g,
        "VG+"
      );

  if (
    /(^|[^A-Z])VG\+([^A-Z]|$)/.test(
      text
    )
  ) {
    return "VG+";
  }

  if (
    /(^|[^A-Z])G\+([^A-Z]|$)/.test(
      text
    )
  ) {
    return "G+";
  }

  if (
    /(^|[^A-Z])NM([^A-Z]|$)/.test(
      text
    )
  ) {
    return "NM";
  }

  if (
    /(^|[^A-Z])VG([^A-Z]|$)/.test(
      text
    )
  ) {
    return "VG";
  }

  if (
    /(^|[^A-Z])M([^A-Z]|$)/.test(
      text
    ) ||
    /\bMINT\b/.test(
      text
    )
  ) {
    return "M";
  }

  if (
    /(^|[^A-Z])G([^A-Z]|$)/.test(
      text
    ) ||
    /\bGOOD\b/.test(
      text
    )
  ) {
    return "G";
  }

  return null;
}

function isRecordGradeAspect(
  name
) {
  const text =
    normalizeText(
      name
    );

  return [
    "record grading",
    "vinyl grading",
    "media grading",
    "record condition",
    "vinyl condition",
    "media condition",
    "plattenzustand",
    "vinylzustand",
    "schallplattenzustand",
  ].some(
    (value) =>
      text.includes(
        normalizeText(
          value
        )
      )
  );
}

function isSleeveGradeAspect(
  name
) {
  const text =
    normalizeText(
      name
    );

  return [
    "sleeve grading",
    "cover grading",
    "jacket grading",
    "sleeve condition",
    "cover condition",
    "jacket condition",
    "coverzustand",
    "hullenzustand",
    "zustand der hulle",
  ].some(
    (value) =>
      text.includes(
        normalizeText(
          value
        )
      )
  );
}

function extractAspectGrades(
  item
) {
  let vinylGrade =
    null;

  let sleeveGrade =
    null;

  for (
    const aspect
    of getItemAspects(
      item
    )
  ) {
    if (
      !vinylGrade &&
      isRecordGradeAspect(
        aspect.name
      )
    ) {
      vinylGrade =
        normalizeGrade(
          aspect.value
        );
    }

    if (
      !sleeveGrade &&
      isSleeveGradeAspect(
        aspect.name
      )
    ) {
      sleeveGrade =
        normalizeGrade(
          aspect.value
        );
    }
  }

  return {
    vinylGrade,
    sleeveGrade,
  };
}

function extractTitlePair(
  title
) {
  const text =
    String(title || "")
      .toUpperCase()
      .replace(
        /\s+/g,
        " "
      );

  const pair =
    text.match(
      /(?:^|[\s(\[])((?:NM|VG\+|VG|G\+|G|M))(?:\s*)\/(?:\s*)((?:NM|VG\+|VG|G\+|G|M))(?:$|[\s)\]])/
    );

  if (!pair) {
    return {
      vinylGrade:
        null,

      sleeveGrade:
        null,
    };
  }

  return {
    vinylGrade:
      normalizeGrade(
        pair[1]
      ),

    sleeveGrade:
      normalizeGrade(
        pair[2]
      ),
  };
}

function extractListingGrades(
  item
) {
  const aspects =
    extractAspectGrades(
      item
    );

  let vinylGrade =
    aspects.vinylGrade;

  let sleeveGrade =
    aspects.sleeveGrade;

  let source =
    vinylGrade &&
    sleeveGrade
      ? "seller_aspects"
      : "mixed";

  const pair =
    extractTitlePair(
      item.title
    );

  if (!vinylGrade) {
    vinylGrade =
      pair.vinylGrade;
  }

  if (!sleeveGrade) {
    sleeveGrade =
      pair.sleeveGrade;
  }

  if (
    !aspects.vinylGrade &&
    !aspects.sleeveGrade &&
    vinylGrade &&
    sleeveGrade
  ) {
    source =
      "title_inferred";
  }

  return {
    vinylGrade,
    sleeveGrade,
    source,

    complete:
      Boolean(
        vinylGrade &&
        sleeveGrade
      ),
  };
}

// ======================================================
// PRESSING-FIRST MATCHING
// ======================================================

function getPressingSignals(
  item,
  discogs
) {
  const raw =
    listingText(
      item
    );

  const normalized =
    normalizeIdentifier(
      raw
    );

  const rawLower =
    normalizeText(
      raw
    );

  let barcodeMatch =
    false;

  let catnoMatch =
    false;

  let yearMatch =
    false;

  let countryMatch =
    false;

  let labelMatch =
    false;

  for (
    const barcode
    of discogs?.barcodes ||
    []
  ) {
    const candidate =
      normalizeBarcode(
        barcode
      );

    if (
      candidate &&
      normalized.includes(
        candidate
      )
    ) {
      barcodeMatch =
        true;

      break;
    }
  }

  for (
    const catno
    of discogs?.catnos ||
    []
  ) {
    const candidate =
      normalizeIdentifier(
        catno
      );

    if (
      candidate.length >= 4 &&
      normalized.includes(
        candidate
      )
    ) {
      catnoMatch =
        true;

      break;
    }
  }

  const year =
    String(
      discogs?.year ||
        ""
    ).trim();

  if (
    year.length === 4 &&
    rawLower.includes(
      year
    )
  ) {
    yearMatch =
      true;
  }

  const country =
    normalizeText(
      discogs?.country ||
        ""
    );

  if (
    country.length >= 2 &&
    rawLower.includes(
      country
    )
  ) {
    countryMatch =
      true;
  }

  for (
    const label
    of discogs?.labels ||
    []
  ) {
    const candidate =
      normalizeText(
        label
      );

    if (
      candidate.length >= 3 &&
      rawLower.includes(
        candidate
      )
    ) {
      labelMatch =
        true;

      break;
    }
  }

  let tier = 1;

  let score = 0;

  if (barcodeMatch) {
    score += 8;
  }

  if (catnoMatch) {
    score += 8;
  }

  if (yearMatch) {
    score += 2;
  }

  if (countryMatch) {
    score += 2;
  }

  if (labelMatch) {
    score += 1;
  }

  if (
    barcodeMatch &&
    catnoMatch
  ) {
    tier = 4;
  } else if (
    catnoMatch &&
    (yearMatch ||
      countryMatch)
  ) {
    tier = 3;
  } else if (
    barcodeMatch
  ) {
    tier = 3;
  } else if (
    yearMatch &&
    countryMatch
  ) {
    tier = 2;
  } else {
    tier = 1;
  }

  return {
    tier,
    score,

    barcodeMatch,
    catnoMatch,
    yearMatch,
    countryMatch,
    labelMatch,
  };
}

function choosePressingPool(
  listings
) {
  const tier4 =
    listings.filter(
      (item) =>
        item.pressingTier ===
        4
    );

  const tier3 =
    listings.filter(
      (item) =>
        item.pressingTier >=
        3
    );

  const tier2 =
    listings.filter(
      (item) =>
        item.pressingTier >=
        2
    );

  if (
    tier4.length >= 2
  ) {
    return {
      pool: tier4,

      scope:
        "barcode_catalog",

      scopeLabel:
        "SAME PRESSING",

      scopeStrength: 4,
    };
  }

  if (
    tier3.length >= 2
  ) {
    return {
      pool: tier3,

      scope:
        "catalog_release",

      scopeLabel:
        "SAME / VERY SIMILAR PRESSING",

      scopeStrength: 3,
    };
  }

  if (
    tier2.length >= 3
  ) {
    return {
      pool: tier2,

      scope:
        "year_country",

      scopeLabel:
        "SAME YEAR / COUNTRY",

      scopeStrength: 2,
    };
  }

  return {
    pool:
      listings,

    scope:
      "album_only",

    scopeLabel:
      "SAME ALBUM — MIXED PRESSINGS",

    scopeStrength: 1,
  };
}

// ======================================================
// CONDITION DISTANCE
// ======================================================

function gradeDistance(
  listing,
  targetVinyl,
  targetSleeve
) {
  const vinylDistance =
    Math.abs(
      GRADE_RANK[
        listing.vinylGrade
      ] -
        GRADE_RANK[
          targetVinyl
        ]
    );

  const sleeveDistance =
    Math.abs(
      GRADE_RANK[
        listing.sleeveGrade
      ] -
        GRADE_RANK[
          targetSleeve
        ]
    );

  let sourcePenalty = 0;

  if (
    listing.gradeSource ===
    "title_inferred"
  ) {
    sourcePenalty =
      0.4;
  } else if (
    listing.gradeSource ===
    "mixed"
  ) {
    sourcePenalty =
      0.15;
  }

  return (
    vinylDistance * 1.6 +
    sleeveDistance +
    sourcePenalty
  );
}

// ======================================================
// STRONG OUTLIER REMOVAL
// ======================================================

function selectConditionPriceCluster(
  listings
) {
  if (
    listings.length <= 3
  ) {
    return [
      ...listings,
    ];
  }

  const sorted =
    [...listings].sort(
      (a, b) =>
        a.price -
        b.price
    );

  let best = [];

  const MAX_RATIO =
    1.5;

  for (
    let start = 0;
    start <
    sorted.length;
    start++
  ) {
    const minimum =
      sorted[start].price;

    const cluster = [];

    for (
      let i = start;
      i <
      sorted.length;
      i++
    ) {
      if (
        sorted[i].price <=
        minimum * MAX_RATIO
      ) {
        cluster.push(
          sorted[i]
        );
      } else {
        break;
      }
    }

    if (
      cluster.length >
      best.length
    ) {
      best =
        cluster;
    } else if (
      cluster.length ===
        best.length &&
      cluster.length
    ) {
      const clusterMedian =
        percentile(
          cluster.map(
            (item) =>
              item.price
          ),
          0.5
        );

      const bestMedian =
        percentile(
          best.map(
            (item) =>
              item.price
          ),
          0.5
        );

      if (
        clusterMedian <
        bestMedian
      ) {
        best =
          cluster;
      }
    }
  }

  if (
    best.length < 3 &&
    sorted.length >= 3
  ) {
    return sorted;
  }

  return best;
}

function removeConditionOutliers(
  listings
) {
  if (
    listings.length <= 2
  ) {
    return listings;
  }

  let working =
    selectConditionPriceCluster(
      listings
    );

  if (
    working.length <= 2
  ) {
    return working;
  }

  // MAD
  const prices =
    working.map(
      (item) =>
        item.price
    );

  const median =
    percentile(
      prices,
      0.5
    );

  const deviations =
    prices.map(
      (price) =>
        Math.abs(
          price -
          median
        )
    );

  const mad =
    percentile(
      deviations,
      0.5
    );

  if (
    mad > 0
  ) {
    const normalizedMad =
      mad * 1.4826;

    const filtered =
      working.filter(
        (item) =>
          Math.abs(
            item.price -
            median
          ) <=
          normalizedMad *
            2.5
      );

    if (
      filtered.length >= 3
    ) {
      working =
        filtered;
    }
  } else {
    const filtered =
      working.filter(
        (item) =>
          item.price >=
            median * 0.72 &&
          item.price <=
            median * 1.28
      );

    if (
      filtered.length >= 3
    ) {
      working =
        filtered;
    }
  }

  if (
    working.length <= 3
  ) {
    return working;
  }

  // final IQR
  const finalPrices =
    working.map(
      (item) =>
        item.price
    );

  const q1 =
    percentile(
      finalPrices,
      0.25
    );

  const q3 =
    percentile(
      finalPrices,
      0.75
    );

  const iqr =
    q3 - q1;

  if (
    iqr <= 0
  ) {
    return working;
  }

  const filtered =
    working.filter(
      (item) =>
        item.price >=
          q1 -
            iqr * 1.5 &&
        item.price <=
          q3 +
            iqr * 1.5
    );

  return filtered.length >= 3
    ? filtered
    : working;
}

// ======================================================
// DETAILED COMPS
// ======================================================

async function fetchDetailedComparableListings({
  artist,
  album,
  discogs,
}) {
  const extraQueries =
    [];

  const catno =
    discogs?.catnos?.[0];

  const barcode =
    discogs?.barcodes?.[0];

  const year =
    discogs?.year;

  const country =
    discogs?.country;

  if (catno) {
    extraQueries.push(
      `${artist} ${album} ${catno} vinyl`
    );
  }

  if (barcode) {
    extraQueries.push(
      `${barcode} vinyl`
    );
  }

  if (
    catno &&
    year
  ) {
    extraQueries.push(
      `${artist} ${album} ${catno} ${year}`
    );
  }

  if (
    year &&
    country
  ) {
    extraQueries.push(
      `${artist} ${album} ${year} ${country} vinyl`
    );
  }

  const search =
    await searchEbaySummaries(
      artist,
      album,
      extraQueries
    );

  const summaries =
    search.items.slice(
      0,
      36
    );

  const detailed = [];

  for (
    let start = 0;
    start <
    summaries.length;
    start += 6
  ) {
    const batch =
      summaries.slice(
        start,
        start + 6
      );

    const results =
      await Promise.allSettled(
        batch.map(
          (item) =>
            getEbayItemDetail(
              item.itemId,
              search.token,
              search.marketplace
            )
        )
      );

    for (
      const result
      of results
    ) {
      if (
        result.status ===
        "fulfilled"
      ) {
        detailed.push(
          result.value
        );
      }
    }

    if (
      detailed.length >= 30
    ) {
      break;
    }
  }

  return detailed;
}

function chooseCurrency(listings) {
  const usdListings = listings.filter(
    (item) => item.currency === "USD"
  );

  return usdListings.length >= 2 ? "USD" : null;
}

// ======================================================
// MONOTONIC HIGH-GRADE GUARD
// ======================================================

function conditionQuality(
  vinylGrade,
  sleeveGrade
) {
  return (
    GRADE_RANK[
      vinylGrade
    ] *
      2 +
    GRADE_RANK[
      sleeveGrade
    ]
  );
}

function applyHighGradeFloor({
  estimate,
  pool,
  vinylGrade,
  sleeveGrade,
  currency,
  scopeStrength,
}) {
  // Only use this safeguard when the pressing/release
  // matching is at least reasonably strong.
  if (
    scopeStrength < 2
  ) {
    return {
      estimate,
      adjusted: false,
    };
  }

  const target =
    conditionQuality(
      vinylGrade,
      sleeveGrade
    );

  const nearbyLower =
    pool.filter(
      (item) => {
        if (
          item.currency !==
          currency
        ) {
          return false;
        }

        const quality =
          conditionQuality(
            item.vinylGrade,
            item.sleeveGrade
          );

        return (
          quality <
            target &&
          quality >=
            target - 3
        );
      }
    );

  if (
    nearbyLower.length < 3
  ) {
    return {
      estimate,
      adjusted: false,
    };
  }

  const cleaned =
    removeConditionOutliers(
      nearbyLower
    );

  if (
    cleaned.length < 3
  ) {
    return {
      estimate,
      adjusted: false,
    };
  }

  const lowerMedian =
    percentile(
      cleaned.map(
        (item) =>
          item.price
      ),
      0.5
    );

  // M / NM should not suddenly estimate far below
  // nearby lower grades of the same release family.
  if (
    lowerMedian &&
    estimate <
      lowerMedian * 0.92
  ) {
    return {
      estimate:
        roundPrice(
          lowerMedian
        ),

      adjusted: true,
    };
  }

  return {
    estimate,
    adjusted: false,
  };
}

// ======================================================
// CONDITION PRICING
// ======================================================

async function calculateConditionPricing({
  artist,
  album,
  vinylGrade,
  sleeveGrade,
  discogs,
}) {
  console.log(
    "CONDITION:",
    artist,
    "-",
    album,
    vinylGrade,
    "/",
    sleeveGrade
  );

  const detailed =
    await fetchDetailedComparableListings({
      artist,
      album,
      discogs,
    });

  const graded = [];

  for (
    const item
    of detailed
  ) {
    const price =
      Number(
        item.price?.value
      );

    const currency =
      item.price?.currency;

    if (
      !Number.isFinite(
        price
      ) ||
      price < 3 ||
      price > 1000 ||
      !currency
    ) {
      continue;
    }

    if (
      !ebayListingMatches(
        item,
        artist,
        album
      )
    ) {
      continue;
    }

    const grades =
      extractListingGrades(
        item
      );

    if (
      !grades.complete
    ) {
      continue;
    }

    const pressing =
      getPressingSignals(
        item,
        discogs
      );

    graded.push({
      title:
        item.title,

      itemWebUrl:
        item.itemWebUrl,

      price,

      currency,

      vinylGrade:
        grades.vinylGrade,

      sleeveGrade:
        grades.sleeveGrade,

      gradeSource:
        grades.source,

      pressingTier:
        pressing.tier,

      pressingScore:
        pressing.score,

      pressingSignals:
        pressing,
    });
  }

  console.log(
    "Detailed listings:",
    detailed.length
  );

  console.log(
    "Graded listings:",
    graded.length
  );

  if (
    graded.length < 2
  ) {
    return null;
  }

  // ====================================================
  // PRESSING FIRST
  // ====================================================

  const pressingSelection =
    choosePressingPool(
      graded
    );

  let pool =
    pressingSelection.pool;

  console.log(
    "Pricing scope:",
    pressingSelection.scopeLabel,
    "listings:",
    pool.length
  );

  const currency =
    chooseCurrency(
      pool
    );

  if (!currency) {
    return null;
  }

  pool =
    pool.filter(
      (item) =>
        item.currency ===
        currency
    );

  if (!pool.length) {
    return null;
  }

  // ====================================================
  // CONDITION SECOND
  // ====================================================

  const scored =
    pool
      .map(
        (item) => ({
          ...item,

          distance:
            gradeDistance(
              item,
              vinylGrade,
              sleeveGrade
            ),
        })
      )
      .sort(
        (a, b) => {
          if (
            a.distance !==
            b.distance
          ) {
            return (
              a.distance -
              b.distance
            );
          }

          return (
            b.pressingScore -
            a.pressingScore
          );
        }
      );

  const exactCondition =
    scored.filter(
      (item) =>
        item.vinylGrade ===
          vinylGrade &&
        item.sleeveGrade ===
          sleeveGrade
    );

  let selected;

  if (
    exactCondition.length >= 2
  ) {
    selected =
      exactCondition.slice(
        0,
        15
      );
  } else {
    const bestDistance =
      scored[0]
        ?.distance;

    if (
      bestDistance ===
      undefined
    ) {
      return null;
    }

    selected =
      scored
        .filter(
          (item) =>
            item.distance <=
            bestDistance + 1
        )
        .slice(
          0,
          10
        );

    if (
      selected.length < 3
    ) {
      selected =
        scored.slice(
          0,
          Math.min(
            6,
            scored.length
          )
        );
    }
  }

  const beforeOutliers =
    selected.length;

  selected =
    removeConditionOutliers(
      selected
    );

  console.log(
    "Condition comps after filtering:",
    selected.map(
      (item) => ({
        price:
          item.price,

        vinyl:
          item.vinylGrade,

        sleeve:
          item.sleeveGrade,

        pressingTier:
          item.pressingTier,
      })
    )
  );

  if (!selected.length) {
    return null;
  }

  const prices =
    selected.map(
      (item) =>
        item.price
    );

  let estimatedPrice =
    roundPrice(
      percentile(
        prices,
        0.5
      )
    );

  const guard =
    applyHighGradeFloor({
      estimate:
        estimatedPrice,

      pool,

      vinylGrade,

      sleeveGrade,

      currency,

      scopeStrength:
        pressingSelection.scopeStrength,
    });

  estimatedPrice =
    guard.estimate;

  let typicalLow =
    roundPrice(
      percentile(
        prices,
        0.25
      )
    );

  let typicalHigh =
    roundPrice(
      percentile(
        prices,
        0.75
      )
    );

  if (
    estimatedPrice >
    typicalHigh
  ) {
    typicalHigh =
      roundPrice(
        estimatedPrice *
          1.08
      );
  }

  if (
    estimatedPrice <
    typicalLow
  ) {
    typicalLow =
      estimatedPrice;
  }

  const exactMatches =
    selected.filter(
      (item) =>
        item.vinylGrade ===
          vinylGrade &&
        item.sleeveGrade ===
          sleeveGrade
    ).length;

  let confidence =
    "low";

  if (
    pressingSelection.scopeStrength >=
      3 &&
    selected.length >= 4 &&
    exactMatches >= 2
  ) {
    confidence =
      "high";
  } else if (
    pressingSelection.scopeStrength >=
      2 &&
    selected.length >= 3
  ) {
    confidence =
      "medium";
  }

  return {
    currency,

    estimatedPrice,

    typicalLow,

    typicalHigh,

    listingsUsed:
      selected.length,

    outliersRemoved:
      beforeOutliers -
      selected.length,

    exactConditionMatches:
      exactMatches,

    totalGradedListings:
      graded.length,

    vinylGrade,

    sleeveGrade,

    scope:
      pressingSelection.scope,

    scopeLabel:
      pressingSelection.scopeLabel,

    scopeStrength:
      pressingSelection.scopeStrength,

    confidence,

    highGradeGuardApplied:
      guard.adjusted,

    comparisons:
      selected
        .slice(0, 6)
        .map(
          (item) => ({
            title:
              item.title,

            price:
              roundPrice(
                item.price
              ),

            currency:
              item.currency,

            vinylGrade:
              item.vinylGrade,

            sleeveGrade:
              item.sleeveGrade,

            itemWebUrl:
              item.itemWebUrl,
          })
        ),

    note:
      "Based on active asking prices, not sold prices.",
  };
}

// ======================================================
// RESULT BUILDER
// ======================================================

function buildResult(
  discogs,
  pricing
) {
  return {
    success: true,

    identified: true,

    artist:
      discogs.artist,

    album:
      discogs.album,

    coverImage:
      discogs.coverImage ||
      null,

    pricing,

    discogs: {
      year:
        discogs.year,

      country:
        discogs.country,

      genres:
        discogs.genres,

      styles:
        discogs.styles,

      labels:
        discogs.labels,

      catnos:
        discogs.catnos,

      barcodes:
        discogs.barcodes,

      matrixRunouts:
        discogs.matrixRunouts,

      coverImage:
        discogs.coverImage,

      discogsUrl:
        discogs.discogsUrl,

      releaseId:
        discogs.releaseId,

      masterId:
        discogs.masterId,

      pressingMatch:
        discogs.pressingMatch ||
        null,

      candidateCount:
        discogs.candidateCount ||
        null,
    },
  };
}

// ======================================================
// IDENTIFY
// ======================================================

app.post(
  "/api/identify",

  upload.single(
    "image"
  ),

  async (req, res) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              "Image is required.",
          });
      }

      const identified =
        await identifyWithGroq(
          req.file
        );

      if (
        !identified
          ?.identified ||
        !identified.artist ||
        !identified.album
      ) {
        return res.json({
          success: true,
          identified: false,
        });
      }

      const discogs =
        await searchDiscogs(
          identified.artist,
          identified.album
        );

      if (!discogs) {
        const pricing =
          await searchEbayPrices(
            identified.artist,
            identified.album
          );

        return res.json({
          success: true,

          identified: true,

          artist:
            identified.artist,

          album:
            identified.album,

          coverImage:
            null,

          pricing,

          discogs:
            null,
        });
      }

      const pricing =
        await searchEbayPrices(
          discogs.artist,
          discogs.album
        );

      return res.json(
        buildResult(
          discogs,
          pricing
        )
      );
    } catch (error) {
      console.error(
        "IDENTIFY ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          error:
            error.message,
        });
    }
  }
);

// ======================================================
// MANUAL
// ======================================================

app.post(
  "/api/manual",

  async (req, res) => {
    try {
      const album =
        String(
          req.body?.album ||
            ""
        ).trim();

      const artist =
        String(
          req.body?.artist ||
            ""
        ).trim();

      if (!album) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              "Album is required.",
          });
      }

      const discogs =
        await searchDiscogsManual(
          artist,
          album
        );

      if (!discogs) {
        return res
          .status(404)
          .json({
            success: false,

            identified:
              false,

            error:
              "Record not found.",
          });
      }

      const pricing =
        await searchEbayPrices(
          discogs.artist,
          discogs.album
        );

      return res.json(
        buildResult(
          discogs,
          pricing
        )
      );
    } catch (error) {
      console.error(
        "MANUAL ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          error:
            error.message,
        });
    }
  }
);

// ======================================================
// BARCODE
// ======================================================

app.post(
  "/api/barcode",

  async (req, res) => {
    try {
      const barcode =
        normalizeBarcode(
          req.body?.barcode
        );

      if (!barcode) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              "Barcode is required.",
          });
      }

      const discogs =
        await searchBarcode(
          barcode
        );

      if (!discogs) {
        return res
          .status(404)
          .json({
            success: false,

            identified:
              false,

            error:
              "No vinyl release found for this barcode.",
          });
      }

      const pricing =
        await searchEbayPrices(
          discogs.artist,
          discogs.album
        );

      return res.json(
        buildResult(
          discogs,
          pricing
        )
      );
    } catch (error) {
      console.error(
        "BARCODE ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          error:
            error.message,
        });
    }
  }
);

// ======================================================
// EXACT PRESSING
// ======================================================

app.post(
  "/api/exact-pressing",

  async (req, res) => {
    try {
      const artist =
        String(
          req.body?.artist ||
            ""
        ).trim();

      const album =
        String(
          req.body?.album ||
            ""
        ).trim();

      const barcode =
        String(
          req.body?.barcode ||
            ""
        ).trim();

      const catno =
        String(
          req.body?.catno ||
            ""
        ).trim();

      const matrix =
        String(
          req.body?.matrix ||
            ""
        ).trim();

      if (
        !album ||
        (!barcode &&
          !catno &&
          !matrix)
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "Enter barcode, catalog number or matrix/runout.",
          });
      }

      const discogs =
        await findExactPressing({
          artist,
          album,
          barcode,
          catno,
          matrix,
        });

      if (!discogs) {
        return res
          .status(404)
          .json({
            success: false,

            identified:
              false,

            error:
              "No matching pressing found.",
          });
      }

      const pricing =
        await searchEbayPrices(
          discogs.artist,
          discogs.album
        );

      return res.json(
        buildResult(
          discogs,
          pricing
        )
      );
    } catch (error) {
      console.error(
        "EXACT PRESSING ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          error:
            error.message,
        });
    }
  }
);

// ======================================================
// CONDITION VALUE
// ======================================================

app.post(
  "/api/condition-value",

  async (req, res) => {
    try {
      const artist =
        String(
          req.body?.artist ||
            ""
        ).trim();

      const album =
        String(
          req.body?.album ||
            ""
        ).trim();

      const vinylGrade =
        String(
          req.body?.vinylGrade ||
            ""
        ).trim();

      const sleeveGrade =
        String(
          req.body?.sleeveGrade ||
            ""
        ).trim();

      const discogs =
        req.body?.discogs ||
        {};

      if (
        !artist ||
        !album
      ) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              "Artist and album are required.",
          });
      }

      if (
        !ALLOWED_GRADES.has(
          vinylGrade
        ) ||
        !ALLOWED_GRADES.has(
          sleeveGrade
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              "Invalid condition grade.",
          });
      }

      const pricing =
        await calculateConditionPricing({
          artist,
          album,
          vinylGrade,
          sleeveGrade,
          discogs,
        });

      if (!pricing) {
        return res
          .status(404)
          .json({
            success: false,

            error:
              "Not enough comparable graded listings were found.",
          });
      }

      return res.json({
        success: true,
        pricing,
      });
    } catch (error) {
      console.error(
        "CONDITION ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          error:
            error.message,
        });
    }
  }
);

// ======================================================
// SERVER ERROR
// ======================================================

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "SERVER ERROR:",
      error
    );

    return res
      .status(500)
      .json({
        success: false,

        error:
          error.message ||
          "Server error.",
      });
  }
);

// ======================================================
// START
// ======================================================

app.listen(
  PORT,
  "0.0.0.0",

  () => {
    console.log(
      `Vinyl Scanner API running on http://0.0.0.0:${PORT}`
    );

    console.log(
      "BACKEND VERSION: PRESSING-CONDITION-V2"
    );
  }
);