import assert from "node:assert/strict";
import test from "node:test";
import {
  createClientKey,
  getBkPlayUrls,
  teaBlock,
  teaPacket
} from "../src/bk.js";

const TEA_KEY = Buffer.from("59b2f7cf725ef43c34fdd7c123411ed3", "hex");

function sequentialRandom() {
  let counter = 0;
  return (size) => {
    const output = Buffer.alloc(size);
    for (let index = 0; index < size; index += 1) {
      output[index] = counter & 0xff;
      counter += 1;
    }
    return output;
  };
}

test("matches the TEA block reference vector", () => {
  assert.equal(
    teaBlock(Buffer.alloc(8), TEA_KEY).toString("hex"),
    "3017822a19141e00"
  );
});

test("matches the TEA packet reference vector", () => {
  const packet = teaPacket(
    Buffer.from("00112233445566778899aabbccddeeff", "hex"),
    TEA_KEY,
    sequentialRandom()
  );
  assert.equal(
    packet.toString("hex"),
    "98670476d2ee7d4ca734f2e95bea65a8e28109566b4596456417d3f063205c5a"
  );
});

test("matches the bklive client-key reference vector", () => {
  const key = createClientKey("2027248703", {
    timestamp: 1792552279,
    randomBytes: sequentialRandom()
  });
  assert.equal(key.guid, "000102030405060708090a0b0c0d0e0f");
  assert.equal(
    key.guard,
    "A1F43D81A4A258F79DDA6E1BA9B7FA88B34A9EE96974E9680A577B70FF7A00C6CC2E3BED"
  );
  assert.equal(
    key.cKey,
    "--01FL2yzLwXi-tS5kGQQiI3dNbAJ9DOKch_lwYEgfwZveM3xeTYCBWNiWTDlUgWtpRsNNG9N2-kC1Od4E1MULBV5u50AwpyNIGvwvQw885gxXw_v_o38FJtlQns097QO_-9omeKzfS8b13DrhIUXjj13rDfmpV4ka2ZIxB99RA2Ou755HtYtTYFoyuOQIxN9UlMnS4Sm6-KwhVA9eeAzPkb5nZ_cVhjUPMbADGrqD_o26O1d-8d_7SinbWWXo4WBSKOaKpRbYfKeEEpYCAy5QsqjoK6IRBTH-g_IPwU7W-f7pXhh9m_r0HFcUCpv-lfmUed1cDEbUuBXy7opWGP12Qw2Cymuu3KJy0NjTNIrkDm9rNGoJuhv8G-EamR5yS5CHZFkTWahtm4rfWpGeGbv1W9SeF4Bx2hUbdIaide2Ll85m1vYRqq0V2684v6MnkpXsmofrQOcGf4_kuD3zFrnILck7lyJ7s"
  );
});

test(
  "CCTV-11 bklive returns a public playlist URL",
  { skip: process.env.LIVE_TEST !== "1" },
  async () => {
    const urls = await getBkPlayUrls("2027248703", "600001806", "fhd");
    assert.ok(urls.length > 0);
    assert.match(urls[0], /^https:\/\/.*\.cctv\.cn\//);
  }
);
