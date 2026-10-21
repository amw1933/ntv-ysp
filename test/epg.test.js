import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeAlias,
  parseXmltv,
  parseXmltvTime,
  shanghaiDateKey,
  shanghaiDayRange
} from "../src/epg.js";

const SAMPLE = `<?xml version="1.0" encoding="utf-8"?>
<tv>
  <channel id="cctv5">
    <display-name>CCTV5</display-name>
    <display-name>CCTV-5 体育</display-name>
  </channel>
  <programme start="20261021100000 +0800" stop="20261021103000 +0800" channel="cctv5">
    <title>体育新闻</title>
  </programme>
  <programme start="20261021103000 +0800" stop="20261021113000 +0800" channel="cctv5">
    <title>比赛直播</title>
  </programme>
</tv>`;

test("normalizes channel aliases", () => {
  assert.equal(normalizeAlias("CCTV-5 体育"), "cctv5体育");
  assert.equal(normalizeAlias("CCTV-5高清"), "cctv5");
});

test("parses XMLTV timestamps with offsets", () => {
  assert.equal(parseXmltvTime("20261021100000 +0800"), 1792548000);
});

test("parses channels and programmes", () => {
  const guide = parseXmltv(SAMPLE);
  assert.equal(guide.aliasToChannel.get("cctv5体育"), "cctv5");
  const programmes = guide.programmesByChannel.get("cctv5");
  assert.equal(programmes.length, 2);
  assert.equal(programmes[0].title, "体育新闻");
});

test("groups days in Asia/Shanghai", () => {
  assert.equal(shanghaiDateKey(1792548000), "2026-10-21");
  assert.deepEqual(shanghaiDayRange("2026-10-21"), {
    start: 1792512000,
    end: 1792598400
  });
});
