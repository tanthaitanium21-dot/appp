// main.js
// เวอร์ชัน V2.1 Fixed: Logic เครื่องทำน้ำอุ่นแบบ V1 (ถูกต้องแม่นยำ)

import { provinces, provinceZones } from './data/provinces.js';
import { mainCableSpecs } from './data/electrical_data.js';
import { calculateProjectCost, setPrice } from './modules/calculator.js';
import { renderCircuitInputs, renderDedicatedCircuitInputs, renderDynamicInputs, formatCurrency } from './modules/ui_renderer.js';
import { generateReport } from './modules/report_generator.js';
import { renderProjectInfoCard, renderWorkDetails, renderSettingsCard, renderSummaryCard, renderJobCostingSection } from './modules/components.js';

// Global State
let manualBOQItems = [];
let manualPOItems = [];
let activeTab = 'boq-combined';

document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
    console.log("App Starting (V2.1 Heater Fixed)...");
    renderAppUI();
    setupStaticData();
    setupEventListeners();
    populatePriceEditor();
    
    // Trigger initial state
    handleProvinceChange();
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
    if(ps) { 
        ps.add(new Option('กรุงเทพมหานคร', 'กรุงเทพมหานคร')); 
        provinces.forEach(p => ps.add(new Option(p, p))); 
        ps.value = 'นนทบุรี'; 
    }
    const rd = document.getElementById('report_date');
    if(rd) rd.valueAsDate = new Date();
}

function setupEventListeners() {
    document.body.addEventListener('change', (e) => {
        if(e.target.matches('input, select')) updateRealtimeTotal();
        
        if(e.target.id === 'province_selector') handleProvinceChange();
        // Note: ไม่ยุ่งกับ main_authority_7 ตามที่ขอ ("มาตรฐานสายเมนไม่ต้องแก้ไข")
        
        if(e.target.id === 'toggle_ev_charger_visibility') handleEVToggle(e.target);
        if(e.target.classList.contains('dedicated-unit-size')) updateBreakerLabel(e.target);
    });

    document.body.addEventListener('input', (e) => {
        if(e.target.matches('input[type="number"], input[type="text"]')) updateRealtimeTotal();
        if(e.target.classList.contains('point-count-input')) {
            renderDynamicInputs(e.target.dataset.prefix, e.target.dataset.index, parseInt(e.target.value)||0);
            updateRealtimeTotal();
        }
    });
    
    setupDynamicListener('socket_circuits', 'socket', 'socket_circuits_container');
    setupDynamicListener('light_circuits', 'light', 'light_circuits_container');
    setupDynamicListener('ac_wiring_units', 'ac_wiring', 'ac_wiring_circuits_container');
    setupDynamicListener('heater_wiring_units', 'heater_wiring', 'heater_wiring_circuits_container');

    const calcBtn = document.getElementById('calculate-btn');
    if(calcBtn) calcBtn.addEventListener('click', displayReport);
    
    setupExportButtons();
    setupCollapsibleCards();
    setupManualJobListeners();
    setupTabListeners();
}

function handleProvinceChange() {
    const province = document.getElementById('province_selector').value;
    const bkkZoneContainer = document.getElementById('bkk_zone_container');
    if(bkkZoneContainer) bkkZoneContainer.classList.toggle('hidden', province !== 'กรุงเทพมหานคร');
    updateRealtimeTotal();
}

// --- Logic: Breaker Label (Auto Select) ---
function updateBreakerLabel(selectElement) {
    const displayId = selectElement.dataset.displayId;
    const type = selectElement.dataset.type;
    const val = parseInt(selectElement.value);
    const displayEl = document.getElementById(displayId);
    
    let text = 'N/A';
    if (type === 'ac') {
        if (val <= 12000) text = '20A';
        else if (val <= 18000) text = '20A';
        else text = '32A';
    } else { // Heater
        if (val <= 3500) text = '20A'; // 3500W
        else if (val <= 4500) text = '20A'; // 4500W (V1 Logic: 4500W ใช้ 20A หรือ 32A ก็ได้ แต่ V1 เดิมใช้ 20A สำหรับ 4500W ถ้าจำไม่ผิด หรือปรับเป็น 32A เพื่อความปลอดภัย)
        else text = '32A'; // 6000W
    }
    
    if(displayEl) displayEl.textContent = `Breaker: ${text}`;
}

function setupDynamicListener(id, type, containerId) {
    const el = document.getElementById(id);
    if(el) el.addEventListener('input', (e) => {
        const count = parseInt(e.target.value)||0;
        if(type === 'socket' || type === 'light') {
            renderCircuitInputs(type, count, document.getElementById(containerId));
        } else {
            renderDedicatedCircuitInputs(type, count, document.getElementById(containerId));
            setTimeout(() => {
                document.querySelectorAll(`#${containerId} .dedicated-unit-size`).forEach(sel => updateBreakerLabel(sel));
            }, 0);
        }
    });
}

function handleEVToggle(input) {
    const wrap = document.getElementById('ev_charger_content_wrapper');
    if(wrap) wrap.classList.toggle('hidden', !input.checked);
    if(!input.checked) { 
        document.getElementById('ev_cable_dist_8').value = 0; 
        document.getElementById('ev_charger_cost_8').value = 0; 
    }
}

// --- Core: Build Quantities (Logic V1 Restore) ---
function buildQuantitiesFromDOM() {
    const quantities = new Map();
    const addQty = (id, val) => { 
        if(!val || val <= 0) return;
        quantities.set(id, (quantities.get(id) || 0) + val);
    };
    const getVal = (id) => parseFloat(document.getElementById(id)?.value) || 0;
    const getInt = (id) => parseInt(document.getElementById(id)?.value) || 0;

    // 1. เสาไฟและเมน (คงเดิมตามที่ขอ)
    const ph = document.getElementById('pole_height_7')?.value;
    const pc = getInt('pole_count_7');
    if (pc > 0 && ph !== '0') {
        if (ph === '6.0') addQty('17.1', pc); 
        else if (ph === '7.0') addQty('17.1-B', pc);
        else if (ph === '8.0') addQty('17.2', pc); 
        else if (ph === '9.0') addQty('17.3', pc);
    }
    addQty('17.4-2', getInt('rack_2_sets_7'));
    addQty('17.4-4', getInt('rack_4_sets_7'));
    addQty('17.5', getVal('main_ext_dist_7'));

    // 2. Consumer Unit
    const cu = document.getElementById('cu_replacement')?.value;
    if(cu !== 'none') {
        const map = {'4_slot':'9.1', '6_slot':'9.2', '8_slot':'9.3', '10_slot':'9.4', '12_slot':'9.5'};
        if(map[cu]) addQty(map[cu], 1);
    }
    if(document.getElementById('install_ground')?.checked) addQty('6.1', 1);
    addQty('10.1', getInt('mcb_16a')); 
    addQty('10.2', getInt('mcb_20a')); 
    addQty('10.3', getInt('mcb_32a'));

    // 3. Sockets & Lights (Standard Logic)
    const sc = getInt('socket_circuits');
    const st = document.getElementById('socket_type')?.value;
    for(let i=1; i<=sc; i++) {
        let dist = getVal(`socket_circuit_${i}_panel_dist`);
        document.querySelectorAll(`input.extra-dist-input[data-circuit="socket-${i}"]`).forEach(inp => dist += (parseFloat(inp.value)||0)/100);
        const pts = getInt(`socket_circuit_${i}_points`);
        if(pts > 0) {
            if(st==='surface_vaf') { addQty('1.3', dist); addQty('3.1', pts); }
            else {
                addQty('1.1', dist);
                if(st.includes('_pvc')) {
                    addQty(st.includes('concealed')?'2.3':'2.1', dist);
                    addQty(st.includes('concealed')?'3.2':'3.1', pts);
                    if(!st.includes('trunking')) addQty('13.1', pts * 2);
                } else if(st.includes('_emt')) {
                    addQty('2.2', dist); addQty('3.1', pts); addQty('13.2', pts * 2);
                }
                if(st.includes('trunking')) addQty('14.1', dist);
            }
        }
    }

    const lc = getInt('light_circuits');
    const lt = document.getElementById('light_type')?.value;
    const ft = document.getElementById('fixture_type_1')?.value;
    for(let i=1; i<=lc; i++) {
        let dist = getVal(`light_circuit_${i}_dist_panel_to_switch`) + getVal(`light_circuit_${i}_dist_switch_to_light`);
        document.querySelectorAll(`input.extra-dist-input[data-circuit="light-${i}"]`).forEach(inp => dist += (parseFloat(inp.value)||0));
        const pts = getInt(`light_circuit_${i}_points`);
        if(pts > 0) {
            addQty('1.2', dist);
            if(lt.includes('_pvc')) {
                addQty(lt.includes('concealed')?'2.3':'2.1', dist);
                if(!lt.includes('trunking')) addQty('13.1', pts * 2);
            } else if(lt.includes('_emt')) {
                addQty('2.2', dist); addQty('13.2', pts * 2);
            } else if(lt.includes('trunking')) addQty('14.1', dist);
            
            if(ft==='LED_E27') addQty('4.1', pts); 
            else if(ft==='LED_PANEL') addQty('15.1', pts); 
            else if(ft==='T8_SET') addQty('15.2', pts);
        }
    }

    // 5. AC/Heater (*** FIXED: V1 Logic Restore ***)
    ['ac_wiring', 'heater_wiring'].forEach(prefix => {
        const count = getInt(`${prefix}_units`);
        const installType = document.getElementById(prefix==='ac_wiring'?'ac_install_type_4':'wh_install_type_5')?.value;
        
        for(let i=1; i<=count; i++) {
            // 1. ดึงค่าระยะละเอียด (ตู้->เบรค, เบรค->เครื่อง, สายดิน)
            const p2b = getVal(`${prefix}_${i}_panel_to_breaker_dist`);
            const b2u = getVal(`${prefix}_${i}_breaker_to_unit_dist`);
            const ground = getVal(`${prefix}_${i}_panel_to_unit_dist_ground`);
            
            // 2. ระยะท่อรวม = 2 ช่วงบวกกัน
            const totalConduitDist = p2b + b2u; 
            
            // 3. ดึงขนาด Watt/BTU เพื่อเลือกเบรกเกอร์
            const unitSizeVal = parseInt(document.getElementById(`${prefix}_${i}_unit_size`)?.value || 0);
            
            // -- คำนวณวัสดุ --
            if(totalConduitDist > 0 || ground > 0) {
                // สายไฟ L,N (ตามระยะท่อจริง)
                addQty('1.4', totalConduitDist);
                // สายดิน (ตามระยะสายดินจริง)
                addQty('1.5', ground);
                
                // ท่อร้อยสาย
                if(totalConduitDist > 0) {
                    if(installType.includes('_pvc')) {
                        addQty(installType.includes('concealed')?'2.3':'2.1', totalConduitDist);
                        if(!installType.includes('trunking')) addQty('13.1', 2); // ข้อต่อเข้าตู้/เข้าเครื่อง
                    } else if(installType.includes('_emt')) {
                        addQty('2.2', totalConduitDist);
                        addQty('13.2', 2);
                    } else if(installType.includes('trunking')) {
                        addQty('14.1', totalConduitDist);
                    }
                }
                
                // กล่องเบรกเกอร์ (1 ชุดต่อเครื่อง)
                addQty('12.1', 1); 
                
                // ตัวลูกเซอร์กิต (เลือกตาม Watt/BTU Logic V1)
                if(prefix === 'ac_wiring') {
                     // Logic แอร์
                    if(unitSizeVal <= 18000) addQty('10.2', 1); // 20A
                    else addQty('10.3', 1); // 32A
                } else {
                    // Logic น้ำอุ่น
                    if(unitSizeVal <= 4500) addQty('10.2', 1); // 3500-4500W -> 20A
                    else addQty('10.3', 1); // 6000W -> 32A
                }
            }
        }
    });

    // 6-10. Misc
    addQty('11.1', getInt('lan_points')); addQty('11.2', getVal('lan_distance'));
    addQty('11.3', getInt('tv_points')); addQty('11.4', getVal('tv_distance'));
    addQty('11.5', getInt('cctv_points'));
    
    addQty('7.1', getInt('heater_units')); 
    addQty('5.1', getInt('ac_units'));
    addQty('5.3', getInt('pump_units')); 
    const pt = document.getElementById('wp_install_type_6')?.value;
    if(pt === 'vct_clip') addQty('16.1', 15 * getInt('pump_units')); 
    else if(pt === 'nyy_burial') { addQty('16.2', 15 * getInt('pump_units')); addQty('2.1', 15 * getInt('pump_units')); }
    
    addQty('5.4', getInt('fan_units'));
    if(document.getElementById('service_inspection')?.checked) addQty('8.1', 1);
    if(document.getElementById('service_leak_find')?.checked) addQty('8.2', 1);
    if(document.getElementById('service_trip_find')?.checked) addQty('8.3', 1);
