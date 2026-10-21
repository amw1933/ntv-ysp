import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLivePlaylist,
  formatCompactTime,
  parseCatchupQuery,
  parseTime,
  rewritePlaylist,
  splitPlaylist,
  toCatchupRange
} from "../src/playlist.js";

test("parses compact Asia/Shanghai catch-up times", () => {
  assert.equal(parseTime("20261021100000"), 1792548000);
  assert.equal(formatCompactTime(1792548000), "20261021100000");
  assert.equal(
    toCatchupRange(1792548000, 1792549800),
    "20261021100000-20261021103000"
  );
});

test("parses playseek ranges and clamps the future", () => {
  const result = parseCatchupQuery(
    "playseek=20261021100000-20991231235959"
  );
  assert.ok(result);
  assert.equal(result.start, 1792548000);
  assert.ok(result.end <= Math.floor(Date.now() / 1000) + 1);
});

test("creates a rolling live playlist without VOD end marker", () => {
  const source = [
    "#EXTM3U",
    "#EXT-X-PLAYLIST-TYPE:VOD",
    "#EXT-X-TARGETDURATION:6",
    "#EXT-X-MEDIA-SEQUENCE:100",
    "#EXT-X-PROGRAM-DATE-TIME:2026-10-21T10:59:49+08:00",
    "#EXTINF:4.0,",
    "a.ts",
    "#EXT-X-PROGRAM-DATE-TIME:2026-10-21T10:59:53+08:00",
    "#EXTINF:4.0,",
    "b.ts",
    "#EXT-X-PROGRAM-DATE-TIME:2026-10-21T10:59:57+08:00",
    "#EXTINF:4.0,",
    "c.ts",
    "#EXT-X-ENDLIST"
  ].join("\n");
  const live = buildLivePlaylist(
    source,
    "https://example.test/live/index.m3u8",
    2
  );
  assert.ok(live);
  assert.match(live.text, /a\.ts/);
  assert.match(live.text, /b\.ts/);
  assert.match(live.text, /c\.ts/);
  assert.doesNotMatch(live.text, /ENDLIST/);
  assert.match(live.text, /#EXT-X-MEDIA-SEQUENCE:100/);
});

test("rewrites media lines and URI attributes", () => {
  const source = [
    "#EXTM3U",
    '#EXT-X-KEY:METHOD=AES-128,URI="key.bin"',
    "#EXTINF:4,",
    "../media/segment.ts"
  ].join("\n");
  const output = rewritePlaylist(
    source,
    "https://example.test/a/b/index.m3u8",
    (url) => `proxy:${url}`
  );
  assert.match(output, /proxy:https:\/\/example\.test\/a\/b\/key\.bin/);
  assert.match(output, /proxy:https:\/\/example\.test\/a\/media\/segment\.ts/);
});

test("extracts segment durations and dates", () => {
  const entries = splitPlaylist(
    [
      "#EXTM3U",
      "#EXT-X-PROGRAM-DATE-TIME:2026-10-21T10:00:00+08:00",
      "#EXTINF:5.5,",
      "one.ts"
    ].join("\n")
  );
  assert.deepEqual(entries, [
    {
      duration: 5.5,
      programDate: "2026-10-21T10:00:00+08:00",
      uri: "one.ts",
      discontinuity: false
    }
  ]);
});

test("keeps segment discontinuity markers", () => {
  const live = buildLivePlaylist(
    [
      "#EXTM3U",
      "#EXT-X-TARGETDURATION:4",
      "#EXT-X-MEDIA-SEQUENCE:7",
      "#EXTINF:4,",
      "a.ts",
      "#EXT-X-DISCONTINUITY",
      "#EXTINF:4,",
      "b.ts"
    ].join("\n"),
    "https://example.test/live/index.m3u8"
  );
  assert.ok(live);
  assert.match(live.text, /#EXT-X-DISCONTINUITY\n#EXTINF/);
});
