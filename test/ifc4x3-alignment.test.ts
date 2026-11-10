// IFC 4.3 adds alignments (e.g. railway tracks aligned on a bridge or track tilt). This test verifies that the
// alignment is converted properly.
//
// See also:
// - https://ifc43-docs.standards.buildingsmart.org/IFC/RELEASE/IFC4x3/HTML/lexical/IfcAlignment.htm
// - https://ifc43-docs.standards.buildingsmart.org/IFC/RELEASE/IFC4x3/HTML/lexical/IfcReferent.htm
// - https://ifc43-docs.standards.buildingsmart.org/IFC/RELEASE/IFC4x3/HTML/lexical/IfcRelNests.htm

import { beforeAll, describe, expect, it } from "vitest";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { extractMetaModel } from "../src/extractor.js";
import type { MetaObject } from "../src/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ALIGNMENT_IFC4X3 = resolve(__dirname, "fixtures/minimal-alignment-IFC4X3.ifc");

describe("minimal-alignment-IFC4X3 alignment and referent", () => {
  let metaObjects: MetaObject[];

  beforeAll(async () => {
    ({ metaObjects } = await extractMetaModel(ALIGNMENT_IFC4X3));
  });

  // #4=IFCRELAGGREGATES('0000000000000000000004',$,$,$,#1,(#2));
  it("places the alignment under the project", () => {
    expect(metaObjects).toContainEqual({
      id: "0000000000000000000002", name: "Alignment", type: "IfcAlignment", parent: "0000000000000000000001",
    });
  });

  // #5=IFCRELNESTS('0000000000000000000005',$,$,$,#2,(#3));
  it("places the referent under the alignment it is nested in", () => {
    expect(metaObjects).toContainEqual({
      id: "0000000000000000000003", name: "Station 0+000", type: "IfcReferent", parent: "0000000000000000000002",
    });
  });
});
