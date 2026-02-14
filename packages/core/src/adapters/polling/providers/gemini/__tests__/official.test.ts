import { parseGoogleRefreshValue, resolveAdcPathCandidates } from "../official";

describe("Gemini official helpers", () => {
  test("parseGoogleRefreshValue parses project suffix", () => {
    const parsed = parseGoogleRefreshValue("refresh-token-value|project-123");

    expect(parsed).toEqual({
      refreshToken: "refresh-token-value",
      projectId: "project-123",
    });
  });

  test("parseGoogleRefreshValue handles plain refresh token", () => {
    const parsed = parseGoogleRefreshValue("refresh-token-value");

    expect(parsed).toEqual({
      refreshToken: "refresh-token-value",
      projectId: null,
    });
  });

  test("resolveAdcPathCandidates includes platform-specific defaults", () => {
    const paths = resolveAdcPathCandidates(
      "/home/tester",
      "C:\\Users\\tester\\AppData\\Roaming",
    ).map((item) => item.replace(/\\/g, "/"));

    expect(paths).toContain(
      "C:/Users/tester/AppData/Roaming/gcloud/application_default_credentials.json",
    );
    expect(paths).toContain(
      "/home/tester/.config/gcloud/application_default_credentials.json",
    );
  });
});
