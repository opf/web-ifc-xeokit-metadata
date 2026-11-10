// Copyright (C) the OpenProject GmbH
// Copyright (C) 2019-2022 BIMspot and the xeokit-metadata contributors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License in the LICENSE file in this directory
// or at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// This file is part of a TypeScript port of xeokit-metadata
// (https://github.com/bimspot/xeokit-metadata).
// Modified by the OpenProject GmbH: ported from C# and Xbim to TypeScript and
// web-ifc.

import * as WebIFC from "web-ifc";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { MetaModel, MetaObject } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// web-ifc ships its .wasm files alongside its compiled JS. Point the runtime
// at that directory; the trailing "/" is load-bearing, the loader concatenates
// `prefix + filename` without inserting a separator.
const WASM_DIR = resolve(__dirname, "../node_modules/web-ifc") + "/";

interface Handle { value: number; type: number }
interface Argument<T> { value: T; type: number; name?: string }

export async function extractMetaModel(ifcPath: string): Promise<MetaModel> {
  const api = new WebIFC.IfcAPI();
  api.SetWasmPath(WASM_DIR, true);
  await api.Init();

  const buf = await readFile(ifcPath);
  const modelID = api.OpenModel(new Uint8Array(buf));
  try {
    return buildMetaModel(api, modelID);
  } finally {
    api.CloseModel(modelID);
  }
}

function buildMetaModel(api: WebIFC.IfcAPI, modelID: number): MetaModel {
  // Example: FILE_NAME('Building-Architecture.ifc','2024-11-14T11:09:12',(''),(''),'IFC-manager for SketchUp (5.3.3)','SketchUp 2024 (24.0.594)','None');
  const fileName = api.GetHeaderLine(modelID, WebIFC.FILE_NAME);
  // Example: FILE_SCHEMA(('IFC4'));
  const fileSchema = api.GetHeaderLine(modelID, WebIFC.FILE_SCHEMA);

  // Pulls the line IDs containing an IFCPROJECT()
  // Example: #13=IFCPROJECT('2Ndyd$OSX7s9A04nc4lyye',#1,'ifc silly sample scene - project','Demystifying IFC with a playful scene using diverse building elements and compositions.',$,$,$,(#11),#14);
  const projectIDs = api.GetLineIDsWithType(modelID, WebIFC.IFCPROJECT);
  if (projectIDs.size() === 0) {
    throw new Error("No IfcProject found in model");
  }
  // Pulls the first project ID
  // Example: #13
  const projectExpressID = projectIDs.get(0);
  // Loads the actual project object. This can be WebIFC.IFC2X3.IfcProjectProject, WebIFC.IFC4.IfcProject, WebIFC.IFC4X3.IfcProject and so on.
  // We are not explicitly naming the types because future versions may be added.
  // Example:
  //   { expressID: 13, GlobalId: { value: "2Ndyd$OSX7s9A04nc4lyye", … }, Name: { value: "ifc silly sample scene - project", … }, … }
  const project = api.GetLine(modelID, projectExpressID);

  return {
    id: project.Name?.value ?? null,
    projectId: strArg(project.GlobalId),
    author: listArg(fileName.arguments[2]).join(";"),
    createdAt: strArg(fileName.arguments[1]),
    schema: strArg(fileSchema.arguments[0]?.[0]),
    creatingApplication: strArg(fileName.arguments[5]),
    metaObjects: extractHierarchy(
      api,
      modelID,
      projectExpressID,
      {
        // This is the "consists-of" relationship
        // Example: #21=IFCRELAGGREGATES('0gLz00O0H9XhZA1crsmo4_',#1,'ifc silly sample scene - project container',$,#13,(#20));
        aggregateChildren: buildRelationMap(
          api, modelID, WebIFC.IFCRELAGGREGATES,
          { parent: "RelatingObject", children: "RelatedObjects" },
        ),
        // This is the "located-in" relationship.
        // Example: #68=IFCRELCONTAINEDINSPATIALSTRUCTURE('3deDUGWdPDIRHoCNFWfaCk',#1,$,$,(#52,#262,#291,#315,#339,#345,#353),#43);
        containedChildren: buildRelationMap(
          api, modelID, WebIFC.IFCRELCONTAINEDINSPATIALSTRUCTURE,
          { parent: "RelatingStructure", children: "RelatedElements" },
        ),
        // This is the "adheres-to" relationship of surface features (IFC4X3 only).
        // Example: #202=IFCRELADHERESTOELEMENT('009ZFyL495cBWyPe43FbdN',#1,$,$,#168,(#179,#203,#211,#219,#227));
        adheredChildren: buildRelationMap(
          api, modelID, WebIFC.IFCRELADHERESTOELEMENT,
          { parent: "RelatingElement", children: "RelatedSurfaceFeatures" },
        ),
        // This is the "nests" relationship, followed only below alignments (IFC4X3 only), e.g. for referents.
        // Example: #3047=IFCRELNESTS('1wV_u4EpX2eRQmudiG$MZe',#1,'Nests',$,#2278,(#2698,#2712,…));
        alignmentNestedChildren: onlyParents(
          // buildRelationMap brings in all IfcRelNests relationship, onlyParents restricts this to only IfcAlignment.
          buildRelationMap(
            api, modelID, WebIFC.IFCRELNESTS,
            { parent: "RelatingObject", children: "RelatedObjects" },
          ),
          new Set(api.GetLineIDsWithType(modelID, WebIFC.IFCALIGNMENT, true)),
        ),
        spatialIDs: new Set(
          api.GetLineIDsWithType(modelID, WebIFC.IFCSPATIALSTRUCTUREELEMENT, true),
        ),
      }
    )
  };
}

interface Relations {
  aggregateChildren: Map<number, number[]>;
  containedChildren: Map<number, number[]>;
  adheredChildren: Map<number, number[]>;
  alignmentNestedChildren: Map<number, number[]>;
  // spatialIDs contains the identifiers of all spatial structure elements. You can use this to look up if an ID
  // is a spatial structure element.
  spatialIDs: Set<number>;
}

interface PendingNode {
  expressID: number;
  parentGuid: string | null;
}

function extractHierarchy(
  api: WebIFC.IfcAPI,
  modelID: number,
  rootID: number,
  relations: Relations,
): MetaObject[] {
  const metaObjects: MetaObject[] = [];
  const stack: PendingNode[] = [{ expressID: rootID, parentGuid: null }];

  while (stack.length > 0) {
    const { expressID, parentGuid } = stack.pop()!;
    const entity = api.GetLine(modelID, expressID);
    const metaObject = {
      id: strArg(entity.GlobalId),
      name: entity.Name?.value ?? null,
      type: api.GetNameFromTypeCode(entity.type),
      parent: parentGuid,
    };

    const isSpatialStructure = relations.spatialIDs.has(expressID);
    const containedChildrenIDs = isSpatialStructure ? (relations.containedChildren.get(expressID) ?? []) : [];
    const aggregatedChildrenIDs = relations.aggregateChildren.get(expressID) ?? [];
    const adheredChildrenIDs = relations.adheredChildren.get(expressID) ?? [];
    const nestedChildrenIDs = relations.alignmentNestedChildren.get(expressID) ?? [];
    const childrenIDs = [
      ...containedChildrenIDs, ...aggregatedChildrenIDs, ...adheredChildrenIDs, ...nestedChildrenIDs,
    ];

    // Push in reverse so the first child is popped first, keeping depth-first pre-order.
    for (let i = childrenIDs.length - 1; i >= 0; i--) {
      stack.push({ expressID: childrenIDs[i], parentGuid: metaObject.id });
    }

    metaObjects.push(metaObject);
  }

  return metaObjects;
}

/**
 * Indexes one IFC relationship type as parent express ID → child express IDs.
 * Relationships sharing a parent are merged in file order; ones missing either
 * side are skipped.
 *
 * @example
 * // #20= IFCRELAGGREGATES('…',$,$,$,#1,(#2,#3));
 * // #21= IFCRELAGGREGATES('…',$,$,$,#1,(#4));
 * buildRelationMap(api, modelID, WebIFC.IFCRELAGGREGATES,
 *   { parent: "RelatingObject", children: "RelatedObjects" });
 * // → Map { 1 => [2, 3, 4] }
 */
function buildRelationMap(
  api: WebIFC.IfcAPI,
  modelID: number,
  relType: number,
  attributes: { parent: string; children: string },
): Map<number, number[]> {
  const map = new Map<number, number[]>();
  for (const relID of api.GetLineIDsWithType(modelID, relType)) {
    const rel = api.GetLine(modelID, relID);
    const parent: Handle | undefined = rel[attributes.parent];
    const children: Handle[] | undefined = rel[attributes.children];
    if (!parent || !children) {
      continue;
    }
    const parentID = parent.value;
    const childIDs = children.map((child) => child.value);
    const earlierChildIDs = map.get(parentID) ?? [];
    map.set(parentID, [...earlierChildIDs, ...childIDs]);
  }
  return map;
}

function onlyParents(map: Map<number, number[]>, parentIDs: Set<number>): Map<number, number[]> {
  return new Map([...map].filter(([parentID]) => parentIDs.has(parentID)));
}

function strArg(arg: Argument<string> | null | undefined): string {
  if (!arg) return "";
  return arg.value ?? "";
}

function listArg(arg: Argument<string>[] | null | undefined): string[] {
  if (!arg || !Array.isArray(arg)) return [];
  return arg.map((a) => a?.value ?? "");
}
