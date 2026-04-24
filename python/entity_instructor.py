import requests

url = "https://api.geekflare.com/search"

headers = {
    "x-api-key": GKF_API_KEY,
    "Content-Type": "application/json",
}

payload = {
  "source": "web",
  "category": "general",
  "format": "json",
  "scrape": true, ## scrape results
  "includeDomains": "url,
  "excludeDomains": "url",
  "time": "any",
  "limit": ~11
}

response = requests.post(
    url,  ## user input field
    json=payload,
    headers=headers
)

print(response.json())