/**
 * Copyright (c) 2018 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author David Sehnal <david.sehnal@gmail.com>
 */

import { PluginContext } from './context';
import { Plugin } from './ui/plugin'
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { PluginCommands } from './command';
import { PluginSpec } from './spec';
import { CreateStructureFromPDBe } from './state/actions/basic';
import { StateTransforms } from './state/transforms';
import { PluginBehaviors } from './behavior';
import { LogEntry } from 'mol-util/log-entry';

function getParam(name: string, regex: string): string {
    let r = new RegExp(`${name}=(${regex})[&]?`, 'i');
    return decodeURIComponent(((window.location.search || '').match(r) || [])[1] || '');
}

const DefaultSpec: PluginSpec = {
    actions: [
        PluginSpec.Action(CreateStructureFromPDBe),
        PluginSpec.Action(StateTransforms.Data.Download),
        PluginSpec.Action(StateTransforms.Data.ParseCif),
        PluginSpec.Action(StateTransforms.Model.CreateStructureAssembly),
        PluginSpec.Action(StateTransforms.Model.CreateStructure),
        PluginSpec.Action(StateTransforms.Model.CreateModelFromTrajectory),
        PluginSpec.Action(StateTransforms.Visuals.CreateStructureRepresentation)
    ],
    behaviors: [
        PluginSpec.Behavior(PluginBehaviors.Representation.HighlightLoci),
        PluginSpec.Behavior(PluginBehaviors.Representation.SelectLoci),
        PluginSpec.Behavior(PluginBehaviors.Representation.DefaultLociLabelProvider)
    ]
}

export function createPlugin(target: HTMLElement): PluginContext {
    const ctx = new PluginContext(DefaultSpec);
    ReactDOM.render(React.createElement(Plugin, { plugin: ctx }), target);

    trySetSnapshot(ctx);

    return ctx;
}

async function trySetSnapshot(ctx: PluginContext) {
    try {
        const snapshotUrl = getParam('snapshot-url', `[^&]+`);
        if (!snapshotUrl) return;
        await PluginCommands.State.Snapshots.Fetch.dispatch(ctx, { url: snapshotUrl })
    } catch (e) {
        ctx.log(LogEntry.error('Failed to load snapshot.'));
        console.warn('Failed to load snapshot', e);
    }
}