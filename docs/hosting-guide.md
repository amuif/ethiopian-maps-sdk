# Self-Hosting Guide for Ethiopian Maps SDK

This guide explains how to deploy `ethiopia.pmtiles` and city slices to your own static storage infrastructure with zero API keys and zero vendor lock-in.

---

## 1. Cloudflare R2 (Recommended for Zero Egress Fees)

Cloudflare R2 provides S3-compatible object storage with **$0 egress bandwidth fees**, making it ideal for serving vector map tiles at scale without unpredictable cloud bills.

### Step 1: Create Bucket & Upload Files
1. Log into your Cloudflare Dashboard and navigate to **R2**.
2. Click **Create Bucket** and name it (e.g. `ethiopia-maps`).
3. Upload `ethiopia.pmtiles` and your city slices (or use `rclone` / AWS CLI).
4. Under **Settings > Public Access**, connect a custom domain (e.g., `tiles.yourcompany.com`) or enable an R2 dev subdomain.

### Step 2: Configure CORS Policy
Under bucket **Settings > CORS Policy**, add the following JSON configuration:

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["Range", "Origin", "Content-Type", "Accept"],
    "ExposeHeaders": ["Content-Range", "Accept-Ranges", "Content-Length"],
    "MaxAgeSeconds": 86400
  }
]
```

---

## 2. Nginx Web Server

If you operate your own VPS or on-premise server in Ethiopia, Nginx can serve PMTiles archives directly from local NVMe or SSD storage with high throughput.

### Configuration (`/etc/nginx/sites-available/maps.conf`):

```nginx
server {
    listen 80;
    listen 443 ssl http2;
    server_name tiles.yourdomain.et;

    root /var/www/tiles;

    location ~* \.pmtiles$ {
        # Enable HTTP Byte-Ranges
        add_header Accept-Ranges bytes;

        # Cross-Origin Resource Sharing (CORS)
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods "GET, HEAD, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Range, Origin, Content-Type, Accept" always;
        add_header Access-Control-Expose-Headers "Content-Range, Content-Length, Accept-Ranges" always;
        add_header Access-Control-Max-Age 86400;

        # Handle CORS preflight
        if ($request_method = 'OPTIONS') {
            return 204;
        }

        # Cache control for immutable archives
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
    }

    # Static glyphs and sprites
    location /glyphs/ {
        add_header Access-Control-Allow-Origin * always;
        expires 30d;
    }

    location /sprites/ {
        add_header Access-Control-Allow-Origin * always;
        expires 30d;
    }
}
```

---

## 3. Amazon Web Services (AWS S3)

### S3 Bucket CORS Configuration:
In the AWS S3 Console, select your bucket, navigate to **Permissions > Cross-origin resource sharing (CORS)**, and paste:

```json
[
  {
    "AllowedHeaders": ["Range", "*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["Content-Range", "Accept-Ranges", "Content-Length"],
    "MaxAgeSeconds": 86400
  }
]
```

---

## 4. Validating Your Deployment

After configuring your endpoint, run the built-in diagnostic tool to verify that byte-ranges and CORS headers are operating correctly:

```bash
# Using CLI
bash tools/check-pmtiles/cli.sh https://tiles.yourdomain.et/ethiopia.pmtiles

# Or open tools/check-pmtiles/index.html in your web browser
```
