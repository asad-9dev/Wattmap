import { describe, expect, it } from "vitest";
import { buildSearchIndex, dice, normalizeQuery, search } from "../../lib/search";

const index = buildSearchIndex({
  schools: [
    { name: "Ajax High School", slug: "ajax-high-school-ajax", city: "Ajax", boardName: "Durham DSB" },
    { name: "St. Mary's Catholic Secondary School", slug: "st-marys-css-pickering", city: "Pickering", boardName: "Durham CDSB" },
    { name: "École secondaire Gaétan-Gervais", slug: "es-gaetan-gervais-oakville", city: "Oakville", boardName: "CS Viamonde" },
    { name: "Pickering High School", slug: "pickering-high-school-ajax", city: "Ajax", boardName: "Durham DSB" },
  ],
  boards: [{ name: "Durham DSB", slug: "durham-dsb" }],
});

describe("normalizeQuery", () => {
  it("folds accents, apostrophes, and punctuation", () => {
    expect(normalizeQuery("St. Mary’s  École")).toBe("st marys ecole");
  });
});

describe("search", () => {
  it("groups schools, cities, and boards", () => {
    const results = search(index, "ajax");
    expect(results.school[0]?.label).toBe("Ajax High School");
    expect(results.city.map((c) => c.label)).toEqual(["Ajax"]);
    expect(results.city[0]?.sublabel).toBe("2 schools");
  });
  it("ranks prefix matches first", () => {
    expect(search(index, "pick").school[0]?.label).toBe("Pickering High School");
  });
  it("ignores accents and apostrophes", () => {
    expect(search(index, "ecole gaetan").school[0]?.href).toBe("/schools/es-gaetan-gervais-oakville");
    expect(search(index, "st marys").school[0]?.label).toBe("St. Mary's Catholic Secondary School");
  });
  it("tolerates a typo", () => {
    expect(search(index, "ajx").school[0]?.label).toBe("Ajax High School");
    expect(dice("durham", "durhma")).toBeGreaterThan(0.5);
  });
  it("needs two characters and returns nothing for noise", () => {
    expect(search(index, "a").school).toHaveLength(0);
    expect(search(index, "zzzzqq").school).toHaveLength(0);
  });
});
