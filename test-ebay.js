import dotenv from "dotenv";

dotenv.config();

const clientId = process.env.EBAY_CLIENT_ID;
const clientSecret = process.env.EBAY_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error("Missing EBAY_CLIENT_ID or EBAY_CLIENT_SECRET");
  process.exit(1);
}

const credentials = Buffer
  .from(`${clientId}:${clientSecret}`)
  .toString("base64");

const body = new URLSearchParams({
  grant_type: "client_credentials",
  scope: "https://api.ebay.com/oauth/api_scope",
});

const response = await fetch(
  "https://api.ebay.com/identity/v1/oauth2/token",
  {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  }
);

const data = await response.json();

console.log("Status:", response.status);

if (response.ok) {
  console.log("SUCCESS");
  console.log("eBay authentication works.");
  console.log("Token expires in:", data.expires_in, "seconds");
} else {
  console.log("FAILED");
  console.log(data);
}