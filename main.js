import { provinces } from './data/provinces.js';
import { calculateProjectCost, getPriceList, setPrice, getAllItems } from './modules/calculator.js';
import { renderCircuitInputs, renderDedicatedCircuitInputs, renderDynamicInputs, formatCurrency } from './modules/ui_renderer.js';
import { generateReport } from './modules/report_generator.js';
import { renderProjectInfoCard, renderWorkDetails, renderSettingsCard, renderSummaryCard, renderJobCostingSection } from './modules/components.js';

let manualBOQItems = [], manualPOItems = [], activeTab = 'boq-combined';

document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
    renderAppUI();
    setupStaticData();
    setupEventListeners();
    populatePriceEditor();
    updateRealtimeTotal();
}

function renderAppUI() {
    const map = {
        'app-project-info': renderProjectInfoCard,
        'app-work-details': renderWorkDetails,
        'app-settings': renderSettingsCard,
        'app-summary': renderSummaryCard,
        'app-manual-job': renderJobCostingSection
    };
    for (const [id, func] of Object.entries(map)) {
        const el = document.getElementById(id);
        if (el) el.innerHTML = func();
    }
}

function setupStaticData() {
    const ps = document.getElementById('province_selector');
    if(ps) { ps.add(new Option('กรุงเทพมหานคร', 'กรุงเทพมหานคร')); provinces.forEach(p => ps.add(new Option(p, p))); }
    const rd = document.getElementById('report_date');
    if(rd) rd.valueAsDate = new Date();
}

function setupEventListeners() {
    // Global Change Listener
    document.body.addEventListener('change', (e) => {
        if(e.target.matches('input, select')) updateRealtimeTotal();
        handleSpecificChanges(e.target);
    });
    document.body.addEventListener('input', (e) => {
        if(e.target.matches('input[type="number"], input[type="text"]')) updateRealtimeTotal();
        // Dynamic inputs
        if(e.target.classList.contains('point-count-input')) {
            renderDynamicInputs(e.target.dataset.prefix, e.target.dataset.index, parseInt(e.target.value)||0);
            updateRealtimeTotal();
        }
    });
    
    // Dynamic Area Init
    setupDynamicListener('socket_circuits', 'socket', 'socket_circuits_container');
    setupDynamicListener('light_circuits', 'light', 'light_circuits_container');
    setupDynamicListener('ac_wiring_units', 'ac_wiring', 'ac_wiring_circuits_container');
    setupDynamicListener('heater_wiring_units', 'heater_wiring', 'heater_wiring_circuits_container');

    // Buttons
    const calcBtn = document.getElementById('calculate-btn');
    if(calcBtn) calcBtn.addEventListener('click', displayReport);
    setupExportButtons();
    setupCollapsibleCards();
    setupManualJobListeners();
    setupTabListeners();
}

function setupDynamicListener(id, type, containerId) {
    const el = document.getElementById(id);
    if(el) el.addEventListener('input', (e) => {
        if(type === 'socket' || type === 'light') renderCircuitInputs(type, parseInt(e.target.value)||0, document.getElementById(containerId));
        else renderDedicatedCircuitInputs(type, parseInt(e.target.value)||0, document.getElementById(containerId));
    });
}

function handleSpecificChanges(input) {
    if(input.id === 'province_selector') {
        const zone = document.getElementById('bkk_zone_container');
        if(zone) zone.classList.toggle('hidden', input.value !== 'กรุงเทพมหานคร');
    }
    if(input.id === 'toggle_ev_charger_visibility') {
        const wrap = document.getElementById('ev_charger_content_wrapper');
        if(wrap) wrap.classList.toggle('hidden', !input.checked);
        if(!input.checked) { document.getElementById('ev_cable_dist_8').value = 0; document.getElementById('ev_charger_cost_8').value = 0; }
    }
}

function buildQuantitiesFromDOM() {
    const quantities = new Map();
    const addQty = (id, val) => quantities.set(id, (quantities.get(id) || 0) + val);
    const getVal = (id) => parseFloat(document.getElementById(id)?.value) || 0;
    const getInt = (id) => parseInt(document.getElementById(id)?.value) || 0;

    // 1. Main
    const ph = document.getElementById('pole_height_7')?.value;
    const pc = getInt('pole_count_7');
    if (pc > 0 && ph !== '0') {
        if (ph === '6.0') addQty('17.1', pc); else if (ph === '7.0') addQty('17.1-B', pc);
        else if (ph === '8.0') addQty('17.2', pc); else if (ph === '9.0') addQty('17.3', pc);
    }
    addQty('17.4-2', getInt('rack_2_sets_7'));
    addQty('17.4-1', getInt('rack_1_set_7')); // New Rack 1 Set
    if (getVal('main_ext_dist_7') > 0) addQty('17.5', getVal('main_ext_dist_7'));

    // 2. Consumer Unit
    const cu = document.getElementById('cu_replacement')?.value;
    if(cu !== 'none') {
        const map = {'4_slot':'9.1', '6_slot':'9.2', '8_slot':'9.3', '10_slot':'9.4', '12_slot':'9.5'};
        if(map[cu]) addQty(map[cu], 1);
    }
    if(document.getElementById('install_ground')?.checked) addQty('6.1', 1);
    addQty('10.1', getInt('mcb_16a')); addQty('10.2', getInt('mcb_20a')); addQty('10.3', getInt('mcb_32a'));

    // 3. Sockets (Sum distances)
    const sc = getInt('socket_circuits');
    const st = document.getElementById('socket_type')?.value;
    for(let i=1; i<=sc; i++) {
        let dist = getVal(`socket_circuit_${i}_panel_dist`);
        document.querySelectorAll(`input.extra-dist-input[data-circuit="socket-${i}"]`).forEach(inp => dist += (parseFloat(inp.value)||0)/100); // cm to m
        const pts = getInt(`socket_circuit_${i}_points`);
        if(pts>0) {
            if(st==='surface_vaf') { addQty('1.3', dist); addQty('3.1', pts); }
            else if(st.includes('_pvc')) { 
                addQty('1.1', dist); addQty(st.includes('concealed')?'2.3':'2.1', dist); 
                addQty(st.includes('concealed')?'3.2':'3.1', pts); 
                if(st.includes('trunking')) addQty('14.1', dist); 
            } else if(st.includes('_emt')) { addQty('1.1', dist); addQty('2.2', dist); addQty('3.1', pts); }
        }
    }

    // 4. Light (Sum distances)
    const lc = getInt('light_circuits');
    const lt = document.getElementById('light_type')?.value;
    const ft = document.getElementById('fixture_type_1')?.value;
    for(let i=1; i<=lc; i++) {
        let dist = getVal(`light_circuit_${i}_dist_panel_to_switch`) + getVal(`light_circuit_${i}_dist_switch_to_light`);
        document.querySelectorAll(`input.extra-dist-input[data-circuit="light-${i}"]`).forEach(inp => dist += (parseFloat(inp.value)||0));
        const pts = getInt(`light_circuit_${i}_points`);
        if(pts>0) {
            addQty('1.2', dist);
            if(lt.includes('_pvc')) addQty(lt.includes('concealed')?'2.3':'2.1', dist);
            else if(lt.includes('_emt')) addQty('2.2', dist); else if(lt.includes('trunking')) addQty('14.1', dist);
            if(ft==='LED_E27') addQty('4.1', pts); else if(ft==='LED_PANEL') addQty('15.1', pts); else if(ft==='T8_SET') addQty('15.2', pts);
        }
    }
    
    // Other categories (Simplified for brevity, ensure full copy)
    ['ac_wiring', 'heater_wiring'].forEach(p => {
        const c = getInt(`${p}_units`);
        const it = document.getElementById(p==='ac_wiring'?'ac_install_type_4':'wh_install_type_5')?.value;
        for(let i=1; i<=c; i++) {
            const d = getVal(`${p}_${i}_dist`);
            if(d>0) { addQty('1.4', d); addQty('1.5', d); if(it.includes('_pvc')) addQty(it.includes('concealed')?'2.3':'2.1', d); else if(it.includes('_emt')) addQty('2.2', d); }
        }
    });
    
    addQty('11.1', getInt('lan_points')); addQty('11.2', getVal('lan_distance'));
    addQty('11.3', getInt('tv_points')); addQty('11.4', getVal('tv_distance'));
    addQty('11.5', getInt('cctv_points'));
    addQty('7.1', getInt('heater_units')); addQty('5.1', getInt('ac_units'));
    addQty('5.3', getInt('pump_units')); 
    const pt = document.getElementById('wp_install_type_6')?.value;
    if(pt === 'vct_clip') addQty('16.1', 15 * getInt('pump_units')); else if(pt === 'nyy_burial') { addQty('16.2', 15 * getInt('pump_units')); addQty('2.1', 15 * getInt('pump_units')); }
    addQty('5.4', getInt('fan_units'));
    if(document.getElementById('service_inspection')?.checked) addQty('8.1', 1);
    if(document.getElementById('service_leak_find')?.checked) addQty('8.2', 1);
    if(document.getElementById('service_trip_find')?.checked) addQty('8.3', 1);
    addQty('8.4', getInt('service_lamp_replace'));
    if(document.getElementById('toggle_ev_charger_visibility')?.checked && getVal('ev_cable_dist_8') > 0) {
        addQty('18.1', 1); if(document.getElementById('ev_install_type_8').value === 'new_meter_tou') addQty('18.2', 1);
        const evCost = getVal('ev_charger_cost_8'); if(evCost > 0) setPrice('M-EV-CHARGER-7KW', evCost);
    }
    addQty('19.1', getInt('demo_lights_9')); addQty('19.2', getInt('demo_outlets_9'));
    addQty('19.3', getInt('demo_cables_9')); addQty('19.4', getInt('demo_ac_9'));
    if(document.getElementById('demo_include_repair_9')?.checked) addQty('19.5', getInt('demo_lights_9') + getInt('demo_outlets_9'));

    return quantities;
}

function performCalculation() {
    const settings = {
        qualityMultiplier: parseFloat(document.getElementById('material_quality').value) || 1.0,
        wastageFactor: (parseFloat(document.getElementById('wastage_factor').value) || 0) / 100,
        overheadFactor: (parseFloat(document.getElementById('overhead_factor').value) || 0) / 100,
        profitFactor: (parseFloat(document.getElementById('profit_factor').value) || 0) / 100,
        province: document.getElementById('province_selector').value,
        bkkZone: document.getElementById('bkk_zone_selector').value,
        includeVat: document.getElementById('include_vat').checked,
        minCharge: parseFloat(document.getElementById('min_charge').value) || 0,
        cableSpecConfig: {
            authority: document.getElementById('main_authority_7').value,
            meterSize: document.getElementById('meter_size_3').value,
            mainType: document.getElementById('main_ext_type_7').value,
            manualSize: document.getElementById('main_cable_size_7').value // รับค่าสาย manual
        }
    };
    return calculateProjectCost(buildQuantitiesFromDOM(), settings, manualPOItems, manualBOQItems);
}

function updateRealtimeTotal() {
    const costs = performCalculation();
    document.getElementById('total-display').textContent = `฿${formatCurrency(costs.totalWithVat)}`;
}

function displayReport() {
    const costs = performCalculation();
    const output = document.getElementById('output-section');
    output.classList.remove('hidden');
    output.scrollIntoView({behavior:'smooth'});
    document.getElementById('report-content').innerHTML = generateReport(costs, activeTab).html;
}

// Export & UI Helpers
function setupExportButtons() {
    document.getElementById('save-pdf-btn')?.addEventListener('click', async () => {
        const btn = document.getElementById('save-pdf-btn');
        btn.innerText = "Processing..."; btn.disabled = true;
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const el = document.getElementById('output-section');
        el.querySelectorAll('.no-print').forEach(e => e.style.display = 'none');
        await doc.html(el, { callback: (doc) => { doc.save('quotation.pdf'); el.querySelectorAll('.no-print').forEach(e => e.style.display = ''); btn.innerText = "PDF"; btn.disabled = false; }, x: 10, y: 10, width: 190, windowWidth: el.scrollWidth });
    });
    document.getElementById('save-image-btn')?.addEventListener('click', () => {
        const el = document.getElementById('output-section');
        el.querySelectorAll('.no-print').forEach(e => e.style.display = 'none');
        html2canvas(el).then(canvas => {
            const link = document.createElement('a'); link.download = 'quotation.png'; link.href = canvas.toDataURL(); link.click();
            el.querySelectorAll('.no-print').forEach(e => e.style.display = '');
        });
    });
}
function setupCollapsibleCards() { document.querySelectorAll('.collapsible-card h3').forEach(h => h.addEventListener('click', () => h.parentElement.classList.toggle('open'))); }
function setupManualJobListeners() { /* ... (Same as prev) ... */ } 
function setupTabListeners() { document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', (e) => { document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('tab-active')); e.target.classList.add('tab-active'); activeTab = e.target.dataset.tab; displayReport(); })); }
function populatePriceEditor() { /* ... (Same as prev) ... */ }
