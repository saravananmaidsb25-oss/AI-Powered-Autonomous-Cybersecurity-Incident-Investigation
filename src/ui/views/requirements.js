import {mandatoryRequirements,projectTitle} from '../../requirements.js';
import {esc} from '../../lib/utils.js';
import {panel} from '../components/panel.js';

export function requirementsView(){return `<p class="text-muted">AI X CYBERSECURITY</p><h2>${esc(projectTitle)}</h2><p>Details and requirements for ${esc(projectTitle)}</p><h3>Description</h3><p class="alert-banner">These are the mandatory product requirements. Current demonstrations use simulated telemetry and responses; production integrations require configuration and validation.</p><div class="layout-grid layout-grid--2">${mandatoryRequirements.map(section=>panel(section.title,`<ul>${section.items.map(item=>`<li>${esc(item)}</li>`).join('')}</ul>`)).join('')}</div>`;}
