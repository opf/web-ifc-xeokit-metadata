// IFC 4.3 adds the ability to have surface features (e.g. road markings). This test checks if this feature works
// properly.
//
// See also:
// - https://ifc43-docs.standards.buildingsmart.org/IFC/RELEASE/IFC4x3/HTML/lexical/IfcRelAdheresToElement.htm
// - https://ifc43-docs.standards.buildingsmart.org/IFC/RELEASE/IFC4x3/HTML/lexical/IfcSurfaceFeature.htm
// - https://ifc43-docs.standards.buildingsmart.org/IFC/RELEASE/IFC4x3/HTML/lexical/IfcRelDecomposes.htm

import { beforeAll, describe, expect, it } from "vitest";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { extractMetaModel } from "../src/extractor.js";
import type { MetaObject } from "../src/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROAD_IFC4X3 = resolve(__dirname, "fixtures/Infra-Road-IFC4X3.ifc");

describe("Infra-Road-IFC4X3 surface features", () => {
  let metaObjects: MetaObject[];
  let byId: Map<string, MetaObject>;

  beforeAll(async () => {
    ({ metaObjects } = await extractMetaModel(ROAD_IFC4X3));
    byId = new Map(metaObjects.map((m) => [m.id, m]));
  });

  it("includes all 20 line markings", () => {
    const markings = metaObjects.filter((m) => m.type === "IfcSurfaceFeature");
    expect(markings).toHaveLength(20);
  });

  it("places every line marking under the IfcCourse it adheres to", () => {
    for (const marking of metaObjects.filter((m) => m.type === "IfcSurfaceFeature")) {
      expect(byId.get(marking.parent!)?.type, `parent of ${marking.id}`).toBe("IfcCourse");
    }
  });

  // #202=IFCRELADHERESTOELEMENT('009ZFyL495cBWyPe43FbdN',#1,$,$,#168,(#179,#203,#211,#219,#227));
  it("maps one adhesion relationship exactly", () => {
    const course = "0bOiufAU17JvMAqTkdbCGK";
    const children = metaObjects
      .filter((m) => m.parent === course)
      .map(({ id, name, type }) => ({ id, name, type }));

    expect(children).toEqual([
      { id: "2E09k8p5j8Ie2cdShEa6y3", name: "road - line marking", type: "IfcSurfaceFeature" },
      { id: "3oFdaVamzCehZnvL2DVyTv", name: "road - line marking", type: "IfcSurfaceFeature" },
      { id: "22Oy65k6H6RQzyRYDT5O81", name: "road - line marking", type: "IfcSurfaceFeature" },
      { id: "3nP$zLBVH1Yxs64yX$MtCU", name: "road - line marking", type: "IfcSurfaceFeature" },
      { id: "3iK_B7RQX1A90d2SZn3haF", name: "road - line marking", type: "IfcSurfaceFeature" },
    ]);
  });
});
