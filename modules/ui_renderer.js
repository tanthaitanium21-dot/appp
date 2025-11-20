// modules/ui_renderer.js
// จัดการ DOM Elements และ HTML Strings

export function renderCircuitInputs(prefix, count, container) {
    container.innerHTML = '';
    if (count <= 0) return;
    
    let html = '';
    // ปรับ Label ให้ตรงตามที่ User ต้องการ
    const distLabel = prefix === 'light' 
        ? `<div><label class="text-sm text-slate-600">ระยะตู้→สวิตช์ (ม.)</label><input type="number" id="${prefix}_circuit_${i}_dist_panel_to_switch" class="form-input mt-1 w-full" placeholder="0"></div>
           <div><label class="text-sm text-slate-600">ระยะสวิตช์→โคม (ม.)</label><input type="number" id="${prefix}_circuit_${i}_dist_switch_to_light" class="form-input mt-1 w-full" placeholder="0"></div>`
        : `<div><label class="text-sm text-slate-600">ระยะตู้ไฟถึงจุดแรก (ม.)</label><input type="number" id="${prefix}_circuit_${i}_panel_dist" class="form-input mt-1 w-full" placeholder="0"></div>`;

    for (let i = 1; i <= count; i++) {
        let circuitDistHtml = '';
        if (prefix === 'light') {
             circuitDistHtml = `
                <div class="grid grid-cols-2 gap-2">
                    <div><label class="text-xs text-slate-500">ตู้→สวิตช์ (ม.)</label><input type="number" id="light_circuit_${i}_dist_panel_to_switch" class="form-input mt-1 w-full" placeholder="0"></div>
                    <div><label class="text-xs text-slate-500">สวิตช์→โคม (ม.)</label><input type="number" id="light_circuit_${i}_dist_switch_to_light" class="form-input mt-1 w-full" placeholder="0"></div>
                </div>`;
        } else {
             circuitDistHtml = `<div><label class="text-sm text-slate-600">ระยะตู้ไฟถึงจุดแรก (ม.)</label><input type="number" id="socket_circuit_${i}_panel_dist" class="form-input mt-1 w-full" placeholder="0"></div>`;
        }

        html += `
            <div class="circuit-container" data-circuit-id="${prefix}-${i}">
                <p class="font-semibold text-gray-800">วงจรที่ ${i}</p>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 mt-2">
                    ${circuitDistHtml}
                    <div>
                        <label class="text-sm text-slate-600">จำนวนจุดในวงจร</label>
                        <input type="number" id="${prefix}_circuit_${i}_points" data-prefix="${prefix}" data-index="${i}" class="point-count-input form-input mt-1 block w-full" placeholder="1" min="1" value="1">
                    </div>
                </div>
                <!-- พื้นที่สำหรับช่องกรอกระยะห่างเพิ่มเติม -->
                <div id="${prefix}_circuit_${i}_extra_dist_container" class="mt-3 pl-4 border-l-2 border-blue-100"></div>
            </div>
        `;
    }
    container.innerHTML = html;
}

// ฟังก์ชันใหม่: สร้างช่องกรอกระยะห่างระหว่างจุด (ไดนามิก)
export function renderDynamicInputs(prefix, circuitIndex, points) {
    const container = document.getElementById(`${prefix}_circuit_${circuitIndex}_extra_dist_container`);
    if (!container) return;

    if (points <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = `<p class="text-xs text-blue-600 font-semibold mb-2">ระยะห่างระหว่างจุดเพิ่ม (ระบุตามจริง):</p>`;
    html += `<div class="grid grid-cols-2 gap-2">`;
    
    const unitLabel = prefix === 'socket' ? 'ซม.' : 'ม.';
    
    for (let j = 1; j < points; j++) {
        const label = prefix === 'socket' 
            ? `จุดที่ ${j} → ${j+1} (ซม.)` 
            : `จุดที่ ${j} → ${j+1} (ม.)`;
            
        html += `
            <div>
                <label class="text-[10px] text-slate-500">${label}</label>
                <input type="number" class="extra-dist-input form-input w-full py-1 text-sm" data-circuit="${prefix}-${circuitIndex}" placeholder="0">
            </div>
        `;
    }
    html += `</div>`;
    container.innerHTML = html;
}

export function renderDedicatedCircuitInputs(prefix, count, container) {
    container.innerHTML = '';
    if (count <= 0) return;
    
    const isAc = prefix === 'ac_wiring';
    const unitSelectorLabel = isAc ? 'ขนาด BTU' : 'ขนาด Watt';
    const unitOptions = isAc 
        ? `<option value="12000">9-12k BTU</option><option value="18000">12-18k BTU</option><option value="24000">18-24k BTU</option><option value="30000">>24k BTU</option>`
        : `<option value="3500"><3.5kW</option><option value="4500">3.5-4.5kW</option><option value="6000">4.5-6kW</option>`;

    let html = '';
    for (let i = 1; i <= count; i++) {
        html += `
            <div class="circuit-container">
                <p class="font-semibold text-gray-800">เครื่องที่ ${i}</p>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 mt-2">
                    <div><label class="text-sm text-slate-600">${unitSelectorLabel}</label><select id="${prefix}_${i}_unit_size" class="form-input mt-1 w-full">${unitOptions}</select></div>
                    <div><label class="text-sm text-slate-600">ระยะตู้→เครื่อง (ม.)</label><input type="number" id="${prefix}_${i}_dist" class="form-input mt-1 w-full" placeholder="0"></div>
                </div>
            </div>`;
    }
    container.innerHTML = html;
}

export function formatCurrency(num) {
    return num.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function createSummaryTable(summaryItems) {
    let rows = summaryItems.map(item => `
        <tr>
            <td class="px-6 py-2 text-right font-semibold text-slate-700 ${item.isTotal ? 'text-base' : ''}">${item.label}</td>
            <td class="px-6 py-2 text-right font-bold w-1/3 ${item.isTotal ? 'text-lg text-red-600' : ''}">${formatCurrency(item.value)}</td>
        </tr>
    `).join('');
    return `<div class="mt-8 flex justify-end"><table class="w-full md:w-2/3 lg:w-1/2 text-sm">${rows}</table></div>`;
}
