// modules/ui_renderer.js
// จัดการ DOM Elements และ HTML Strings

export function renderCircuitInputs(prefix, count, container) {
    container.innerHTML = '';
    if (count <= 0) return;
    
    let html = '';
    for (let i = 1; i <= count; i++) {
        html += `
            <div class="circuit-container" data-circuit-id="${prefix}-${i}">
                <p class="font-semibold text-gray-800">วงจรที่ ${i}</p>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 mt-2">
                    <label class="text-sm text-slate-600">ระยะทางในวงจรนี้ (เมตร)</label>
                    ${prefix === 'light' 
                    ? `<div class="grid grid-cols-2 gap-2">
                        <div><input type="number" id="${prefix}_circuit_${i}_dist_panel_to_switch" class="form-input mt-1 block w-full sm:text-sm dist-part-input" placeholder="ตู้→สวิตช์" min="0"><p class="text-xs text-slate-500 mt-1">ตู้→สวิตช์</p></div>
                        <div><input type="number" id="${prefix}_circuit_${i}_dist_switch_to_light" class="form-input mt-1 block w-full sm:text-sm dist-part-input" placeholder="สวิตช์→โคม" min="0"><p class="text-xs text-slate-500 mt-1">สวิตช์→โคม</p></div>
                       </div><input type="hidden" id="${prefix}_circuit_${i}_panel_dist" class="dist-input">`
                    : `<div><input type="number" id="${prefix}_circuit_${i}_panel_dist" class="form-input mt-1 block w-full sm:text-sm" placeholder="0" min="0"></div>`
                    }
                    <div>
                        <label for="${prefix}_circuit_${i}_points" class="text-sm text-slate-600">จำนวนจุด</label>
                        <input type="number" id="${prefix}_circuit_${i}_points" data-point-control-for="${prefix}-${i}" class="point-count-input form-input mt-1 block w-full sm:text-sm" placeholder="จุด" min="1">
                    </div>
                </div>
                <div id="inter_point_container_${prefix}-${i}" class="mt-3"></div>
            </div>
        `;
    }
    container.innerHTML = html;
}

export function renderDedicatedCircuitInputs(prefix, count, container) {
    container.innerHTML = '';
    if (count <= 0) return;
    
    const isAc = prefix === 'ac_wiring';
    const unitSelectorLabel = isAc ? 'ขนาด BTU' : 'ขนาด Watt';
    const unitOptions = isAc 
        ? `<option value="12000">9,000 - 12,000 BTU</option><option value="18000">12,001 - 18,000 BTU</option><option value="24000">18,001 - 24,000 BTU</option><option value="30000">&gt; 24,000 BTU</option>`
        : `<option value="3500">&lt; 3,500 W</option><option value="4500">3,501 - 4,500 W</option><option value="6000">4,501 - 6,000 W</option><option value="8000">&gt; 6,000 W</option>`;

    let html = '';
    for (let i = 1; i <= count; i++) {
        html += `
            <div class="circuit-container" data-circuit-id="${prefix}-${i}">
                <p class="font-semibold text-gray-800">เครื่องที่ ${i}</p>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 mt-2">
                    <div><label class="text-sm text-slate-600">${unitSelectorLabel}</label><select id="${prefix}_${i}_unit_size" data-breaker-target="${prefix}_${i}_breaker" class="unit-size-selector form-input mt-1 block w-full sm:text-sm">${unitOptions}</select></div>
                    <div><label class="text-sm text-slate-600">เบรกเกอร์แนะนำ</label><p id="${prefix}_${i}_breaker" class="mt-1 p-2 bg-slate-100 rounded-md text-slate-800 font-medium h-[38px] flex items-center">--</p></div>
                    <div><label class="text-sm text-slate-600">ระยะ ตู้→เบรกเกอร์ (ม.)</label><input type="number" id="${prefix}_${i}_panel_to_breaker_dist" class="dist-input form-input mt-1 block w-full sm:text-sm" placeholder="เมตร" min="0"></div>
                    <div><label class="text-sm text-slate-600">ระยะ เบรกเกอร์→เครื่อง (ม.)</label><input type="number" id="${prefix}_${i}_breaker_to_unit_dist" class="dist-input form-input mt-1 block w-full sm:text-sm" placeholder="เมตร" min="0"></div>
                    <div class="md:col-span-2"><label class="text-sm text-slate-600">ระยะสายดิน (ม.)</label><input type="number" id="${prefix}_${i}_panel_to_unit_dist_ground" class="dist-input form-input mt-1 block w-full sm:text-sm" placeholder="เมตร" min="0"></div>
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