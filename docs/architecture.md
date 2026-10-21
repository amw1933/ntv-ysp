# Architecture

## Data flow

```text
browser / TV player
        |
        v
GET /cctv5.m3u8
        |
        +--> JCE time-shift request --> upsteam m3u8
        |                                |
        |                                +--> rewrite every segment
        |
        v
local playlist with /media/<token> URLs
        |
        v
GET /media/<token> --> upstream TS (Range supported)
```

## Modules

- `src/channels.js`: channel IDs and M3U generation.
- `src/epg.js`: XMLTV download, parsing and Asia/Shanghai date grouping.
- `src/jce.js`: binary request framing and time-shift URL lookup.
- `src/playlist.js`: catch-up parsing, rolling live playlists and URL rewriting.
- `src/server.js`: HTTP server, media tokens, playlist cache and proxy.
- `web/`: browser client.

## Live behavior

The upstream time-shift endpoint is queried for a short trailing window. The
server keeps the newest segments and republishes them as a rolling HLS playlist.
The client reloads that playlist as a normal live stream.

## Catch-up behavior

A `playseek` range is parsed and sent to the time-shift endpoint. The returned
VOD playlist is rewritten so every segment is fetched through the local server
with the required upstream headers.

## Program guide

The guide is loaded from the public autoEPG XMLTV release, cached for 30 minutes,
and indexed by channel ID and display-name aliases. `GET /api/epg/<channel>`
returns the programmes for one Asia/Shanghai calendar day.

The browser shows a bottom programme drawer. Selecting an ended programme sends
its exact `start` and `stop` values to the normal catch-up endpoint. Selecting
the current programme returns to live playback.

## Native clients

Android and HarmonyOS should consume the same HTTP contract:

1. Resolve playback through `/api/channels`.
2. Pass the resulting HLS URL to the native player.
3. Keep playlist and segment requests on the gateway, where headers and tokens
   are handled consistently.
