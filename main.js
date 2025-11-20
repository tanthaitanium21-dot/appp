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

// ... (renderAppUI, setupStaticData same as before) ...

function setupEventListeners() {
    // Listen to input/change
    document.body.addEventListener('change', (e) => {
        if(e.target.matches('input, select')) updateRealtimeTotal();
        handleSpecificChanges(e.target);
    });
    document.body.addEventListener('input', (e) => {
        if(e.target.matches('input[type="number"], input[type="text"]')) updateRealtimeTotal();
        
        // Logic: เมื่อกรอกจำนวนจุด -> สร้างช่องกรอกระยะห่าง (Dynamic Inputs)
        if(e.target.classList.contains('point-count-input')) {
            renderDynamicInputs(e.target.dataset.prefix, e.target.dataset.index, parseInt(e.target.value)||0);
            updateRealtimeTotal();
        }
    });
    
    // Initial Render for Circuits
    setupDynamicListener('socket_circuits', 'socket', 'socket_circuits_container');
    setupDynamicListener('light_circuits', 'light', 'light_circuits_container');
    setupDynamicListener('ac_wiring_units', 'ac_wiring', 'ac_wiring_circuits_container');
    setupDynamicListener('heater_wiring_units', 'heater_wiring', 'heater_wiring_circuits_container');

    document.getElementById('calculate-btn')?.addEventListener('click', displayReport);
    setupExportButtons();
    setupCollapsibleCards();
    setupManualJobListeners();
    setupTabListeners();
}

// ... (Helpers same as before) ...

function buildQuantitiesFromDOM() {
    const quantities = new Map();
    const addQty = (id, val) => quantities.set(id, (quantities.get(id) || 0) + val);
    const getVal = (id) => parseFloat(document.getElementById(id)?.value) || 0;
    const getInt = (id) => parseInt(document.getElementById(id)?.value) || 0;

    // 1. Main (Manual Cable & New Rack)
    const ph = document.getElementById('pole_height_7')?.value;
    const pc = getInt('pole_count_7');
    if (pc > 0 && ph !== '0') {
        if (ph === '6.0') addQty('17.1', pc); else if (ph === '7.0') addQty('17.1-B', pc);
        else if (ph === '8.0') addQty('17.2', pc); else if (ph === '9.0') addQty('17.3', pc);
    }
    addQty('17.4-2', getInt('rack_2_sets_7'));
    addQty('17.4-1', getInt('rack_1_set_7')); // Rack 1 Set
    
    if (getVal('main_ext_dist_7') > 0) addQty('17.5', getVal('main_ext_dist_7'));

    // 2. Consumer Unit
    // ... (Same logic) ...
    
    // 3. Sockets (Logic ใหม่: บวกระยะเพิ่ม)
    const sc = getInt('socket_circuits');
    const st = document.getElementById('socket_type')?.value;
    for(let i=1; i<=sc; i++) {
        let dist = getVal(`socket_circuit_${i}_panel_dist`);
        
        // บวกระยะจากช่องกรอกเพิ่ม (ซม. -> เมตร)
        document.querySelectorAll(`input.extra-dist-input[data-circuit="socket-${i}"]`).forEach(inp => {
            dist += (parseFloat(inp.value)||0) / 100;
        });

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

    // 4. Light (Logic ใหม่)
    const lc = getInt('light_circuits');
    const lt = document.getElementById('light_type')?.value;
    const ft = document.getElementById('fixture_type_1')?.value;
    for(let i=1; i<=lc; i++) {
        let dist = getVal(`light_circuit_${i}_dist_panel_to_switch`) + getVal(`light_circuit_${i}_dist_switch_to_light`);
        
        // บวกระยะจากช่องกรอกเพิ่ม (เมตร)
        document.querySelectorAll(`input.extra-dist-input[data-circuit="light-${i}"]`).forEach(inp => {
            dist += (parseFloat(inp.value)||0);
        });

        const pts = getInt(`light_circuit_${i}_points`);
        if(pts>0) {
            addQty('1.2', dist);
            if(lt.includes('_pvc')) addQty(lt.includes('concealed')?'2.3':'2.1', dist);
            else if(lt.includes('_emt')) addQty('2.2', dist); else if(lt.includes('trunking')) addQty('14.1', dist);
            if(ft==='LED_E27') addQty('4.1', pts); else if(ft==='LED_PANEL') addQty('15.1', pts); else if(ft==='T8_SET') addQty('15.2', pts);
        }
    }
    
    // ... (Other parts same as before) ...
    
    return quantities;
}

function performCalculation() {
    const settings = {
        // ... (Settings) ...
        cableSpecConfig: {
            // ส่งค่า Manual Size ไปคำนวณ
            manualSize: document.getElementById('main_cable_size_7').value,
            mainType: document.getElementById('main_ext_type_7').value
        }
    };
    return calculateProjectCost(buildQuantitiesFromDOM(), settings, manualPOItems, manualBOQItems);
}

// ... (Rest same as before) ...
