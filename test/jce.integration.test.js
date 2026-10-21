import assert from "node:assert/strict";
import test from "node:test";
import { getTimeshiftUrl } from "../src/jce.js";

test(
  "requests a current CCTV-5 catch-up playlist",
  { skip: process.env.LIVE_TEST !== "1" },
  async () => {
    const end = Math.floor(Date.now() / 1000) - 20;
    const url = await getTimeshiftUrl({
      pid: "600001818",
      sid: "2024078401",
      start: end - 120,
      end
    });
    assert.match(url, /^https?:\/\//);
    assert.match(url, /\.m3u8/);
  }
);
