const url = "https://swarty.scalekit.dev/.well-known/openid-configuration";
fetch(url)
  .then(res => res.json())
  .then(data => {
    console.log("Discovery config retrieved successfully!");
    console.log("jwks_uri:", data.jwks_uri);
  })
  .catch(err => {
    console.error("Failed to fetch discovery document:", err);
  });
