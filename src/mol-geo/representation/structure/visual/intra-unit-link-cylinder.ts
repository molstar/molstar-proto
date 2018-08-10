/**
 * Copyright (c) 2018 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 * @author David Sehnal <david.sehnal@gmail.com>
 */

import { ValueCell } from 'mol-util/value-cell'

import { MeshRenderObject } from 'mol-gl/render-object'
import { Unit, Link, StructureElement } from 'mol-model/structure';
import { UnitsVisual, DefaultStructureProps } from '..';
import { RuntimeContext } from 'mol-task'
import { DefaultLinkCylinderProps, LinkCylinderProps, createLinkCylinderMesh } from './util/link';
import { Mesh } from '../../../shape/mesh';
import { PickingId } from '../../../util/picking';
import { Vec3 } from 'mol-math/linear-algebra';
// import { createUniformColor } from '../../../util/color-data';
import { Loci, isEveryLoci, EmptyLoci } from 'mol-model/loci';
import { MarkerAction, applyMarkerAction, MarkerData } from '../../../util/marker-data';
import { SizeTheme } from '../../../theme';
import { createColors, createUnitsMeshRenderObject } from './util/common';
import { updateMeshValues, updateRenderableState, DefaultMeshProps } from '../../util';
import { LinkIterator } from './util/location-iterator';
import { deepEqual } from 'mol-util';

async function createIntraUnitLinkCylinderMesh(ctx: RuntimeContext, unit: Unit, props: LinkCylinderProps, mesh?: Mesh) {
    if (!Unit.isAtomic(unit)) return Mesh.createEmpty(mesh)

    const elements = unit.elements;
    const links = unit.links
    const { edgeCount, a, b, edgeProps, offset } = links
    const { order: _order, flags: _flags } = edgeProps

    if (!edgeCount) return Mesh.createEmpty(mesh)

    const vRef = Vec3.zero()
    const pos = unit.conformation.invariantPosition

    const builderProps = {
        linkCount: edgeCount * 2,
        referencePosition: (edgeIndex: number) => {
            let aI = a[edgeIndex], bI = b[edgeIndex];
            if (aI > bI) [aI, bI] = [bI, aI]
            for (let i = offset[aI], il = offset[aI + 1]; i < il; ++i) {
                if (b[i] !== bI) return pos(elements[b[i]], vRef)
            }
            for (let i = offset[bI], il = offset[bI + 1]; i < il; ++i) {
                if (a[i] !== aI) return pos(elements[a[i]], vRef)
            }
            return null
        },
        position: (posA: Vec3, posB: Vec3, edgeIndex: number) => {
            pos(elements[a[edgeIndex]], posA)
            pos(elements[b[edgeIndex]], posB)
        },
        order: (edgeIndex: number) => _order[edgeIndex],
        flags: (edgeIndex: number) => _flags[edgeIndex]
    }

    return createLinkCylinderMesh(ctx, builderProps, props, mesh)
}

export const DefaultIntraUnitLinkProps = {
    ...DefaultMeshProps,
    ...DefaultStructureProps,
    ...DefaultLinkCylinderProps,
    sizeTheme: { name: 'physical', factor: 0.3 } as SizeTheme,
}
export type IntraUnitLinkProps = Partial<typeof DefaultIntraUnitLinkProps>

export function IntraUnitLinkVisual(): UnitsVisual<IntraUnitLinkProps> {
    let renderObject: MeshRenderObject
    let currentProps: typeof DefaultIntraUnitLinkProps
    let mesh: Mesh
    let currentGroup: Unit.SymmetryGroup

    return {
        get renderObject () { return renderObject },
        async create(ctx: RuntimeContext, group: Unit.SymmetryGroup, props: IntraUnitLinkProps = {}) {
            currentProps = Object.assign({}, DefaultIntraUnitLinkProps, props)
            currentGroup = group

            const unit = group.units[0]
            mesh = await createIntraUnitLinkCylinderMesh(ctx, unit, currentProps)

            const locationIt = LinkIterator.fromGroup(group)
            renderObject = createUnitsMeshRenderObject(group, mesh, locationIt, currentProps)
        },
        async update(ctx: RuntimeContext, props: IntraUnitLinkProps) {
            const newProps = Object.assign({}, currentProps, props)

            if (!renderObject) return false

            let updateColor = false

            // TODO create in-place
            if (currentProps.radialSegments !== newProps.radialSegments) return false

            if (!deepEqual(newProps.colorTheme, currentProps.colorTheme)) {
                updateColor = true
            }

            if (updateColor) {
                createColors(LinkIterator.fromGroup(currentGroup), newProps.colorTheme, renderObject.values)
            }

            updateMeshValues(renderObject.values, newProps)
            updateRenderableState(renderObject.state, newProps)

            currentProps = newProps
            return true
        },
        getLoci(pickingId: PickingId) {
            return getLinkLoci(pickingId, currentGroup, renderObject.id)
        },
        mark(loci: Loci, action: MarkerAction) {
            markLink(loci, action, currentGroup, renderObject.values)
        },
        destroy() {
            // TODO
        }
    }
}

function getLinkLoci(pickingId: PickingId, group: Unit.SymmetryGroup, id: number) {
    const { objectId, instanceId, elementId } = pickingId
    const unit = group.units[instanceId]
    if (id === objectId && Unit.isAtomic(unit)) {
        return Link.Loci([
            Link.Location(
                unit, unit.links.a[elementId] as StructureElement.UnitIndex,
                unit, unit.links.b[elementId] as StructureElement.UnitIndex
            )
        ])
    }
    return EmptyLoci
}

function markLink(loci: Loci, action: MarkerAction, group: Unit.SymmetryGroup, values: MarkerData) {
    const tMarker = values.tMarker
    const unit = group.units[0]
    if (!Unit.isAtomic(unit)) return

    const elementCount = unit.links.edgeCount * 2
    const instanceCount = group.units.length

    let changed = false
    const array = tMarker.ref.value.array
    if (isEveryLoci(loci)) {
        applyMarkerAction(array, 0, elementCount * instanceCount, action)
        changed = true
    } else if (Link.isLoci(loci)) {
        for (const b of loci.links) {
            const unitIdx = Unit.findUnitById(b.aUnit.id, group.units)
            if (unitIdx !== -1) {
                const _idx = unit.links.getDirectedEdgeIndex(b.aIndex, b.bIndex)
                if (_idx !== -1) {
                    const idx = _idx
                    if (applyMarkerAction(array, idx, idx + 1, action) && !changed) {
                        changed = true
                    }
                }
            }
        }
    } else {
        return
    }
    if (changed) {
        ValueCell.update(tMarker, tMarker.ref.value)
    }
}