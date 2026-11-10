#!/usr/bin/env node
// Copyright (C) the OpenProject GmbH
// Copyright (C) 2019-2022 BIMspot and the xeokit-metadata contributors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License in the LICENSE file at the package root
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

// CLI entry point.
//   web-ifc-xeokit-metadata <input.ifc> <output.json>
//
// Drop-in replacement for the .NET-based xeokit-metadata invoked by
// modules/bim/app/services/bim/ifc_models/view_converter_service.rb.
import { writeFile } from "node:fs/promises";
import { extractMetaModel } from "./extractor.js";

const [ifcPath, jsonPath] = process.argv.slice(2);

if (!ifcPath || !jsonPath) {
  console.error("Usage: web-ifc-xeokit-metadata <input.ifc> <output.json>");
  process.exit(1);
}

try {
  const meta = await extractMetaModel(ifcPath);
  await writeFile(jsonPath, JSON.stringify(meta, null, 2));
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
