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

export interface MetaObject {
  id: string;
  name: string | null;
  type: string;
  parent: string | null;
}

export interface MetaModel {
  id: string | null;
  projectId: string;
  author: string;
  createdAt: string;
  schema: string;
  creatingApplication: string;
  metaObjects: MetaObject[];
}
