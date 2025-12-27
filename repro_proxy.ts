
const urlStr = "https://abmedia.io/wp-content/uploads/2025/12/2025-12-27-175200.png";
console.log("Testing Valid URL:", urlStr);

try {
    const u = new URL(urlStr);
    console.log("URL parsing success:", u.href);

    console.log("Fetching...");
    const res = await fetch(urlStr, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "image/*,*/*;q=0.8",
            "Referer": new URL(urlStr).origin,
        },
    });
    console.log("Fetch status:", res.status);
    if (!res.ok) {
        console.log("Fetch failed text:", await res.text());
    } else {
        console.log("Fetch success, content-type:", res.headers.get("content-type"));
    }
} catch (e) {
    console.error("Error:", e);
}
