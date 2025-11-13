# Performance Tuning

This document explains how to fine-tune the application's performance based on your system specifications.

## Data Refresh Interval

The application periodically fetches new ticker data to keep the information up-to-date. The frequency of these updates can be controlled via an environment variable. A shorter interval provides more real-time data but increases network and CPU usage, which may impact performance on lower-spec systems.

### `NEXT_PUBLIC_REFRESH_INTERVAL`

You can control the data refresh rate using the `NEXT_PUBLIC_REFRESH_INTERVAL` environment variable. This variable sets the interval in **milliseconds**.

- **Default Value:** `5000` (5 seconds)
- **Recommended Minimum:** `1000` (1 second)

Setting a value lower than 1000ms is not recommended as it may lead to API rate-limiting or system instability.

### How to Set the Environment Variable

To run the application with a custom refresh interval, you need to set the environment variable before starting the development server.

**Windows (Command Prompt):**
```bash
set NEXT_PUBLIC_REFRESH_INTERVAL=3000 && npm run dev
```

**Windows (PowerShell):**
```bash
$env:NEXT_PUBLIC_REFRESH_INTERVAL="3000"; npm run dev
```

**Linux / macOS:**
```bash
NEXT_PUBLIC_REFRESH_INTERVAL=3000 npm run dev
```

### Finding Your Optimal Interval

1.  **Start with a lower value:** Try setting the interval to `2000` (2 seconds).
2.  **Monitor Performance:** Run the application and observe your system's CPU usage and the application's responsiveness.
3.  **Adjust:** 
    - If the application feels sluggish or your CPU usage is consistently high, increase the interval (e.g., to `3000`).
    - If the system handles it well, you can try decreasing it further, but avoid going below `1000`.

By experimenting with this setting, you can find the best balance between real-time data and system performance for your specific hardware.
