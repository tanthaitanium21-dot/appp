// =========================================================
// MODULE: ระบบไฟฟ้า (Electrical Logic V6)
// =========================================================

const Electrical = {
    calculate(appData, priceList) {
        const quantities = new Map();
        const add = (id, v) => quantities.set(id, (quantities.get(id) || 0) + v);

        // 1. วงจรย่อย (Circuits)
        ['socket', 'light'].forEach(prefix => {
            const count = Core.val(`${prefix}_circuits`);
            const type = Core.str(`${prefix}_type`);
            
            if (count > 0) {
                for (let i = 1; i <= count; i++) {
                    const panelDist = Core.val(`${prefix}_circuit_${i}_panel_dist`);
                    const points = Core.val(`${prefix}_circuit_${i}_points`);
                    const wiring = panelDist + (points * 2); // สูตร V6 ประมาณการ

                    if (prefix === 'socket') {
                        if (type.includes('vaf')) { add('1.3', wiring); add('3.1', points); }
                        else {
                            add('1.1', wiring);
                            add(type.includes('concealed') ? '2.3' : '2.1', wiring);
                            add(type.includes('concealed') ? '3.2' : '3.1', points);
                        }
                    } else {
                        add('1.2', wiring); add('2.1', wiring);
                        const fixType = Core.str('fixture_type_1');
                        if (fixType === 'LED_PANEL') add('15.1', points);
                        else if (fixType === 'T8_SET') add('15.2', points);
                        else add('4.1', points);
                    }
                }
            }
        });

        // 2. แอร์ & น้ำอุ่น (Dedicated Circuits)
        ['ac_wiring', 'heater_wiring'].forEach(prefix => {
            const unitCount = Core.val(`${prefix}_units`);
            const installType = Core.str(prefix === 'ac_wiring' ? 'ac_install_type_4' : 'wh_install_type_5');

            for (let i = 1; i <= unitCount; i++) {
                const p2b = Core.val(`${prefix}_${i}_panel_to_breaker_dist`);
                const b2u = Core.val(`${prefix}_${i}_breaker_to_unit_dist`);
                const gnd = Core.val(`${prefix}_${i}_panel_to_unit_dist_ground`);
                const breakerEl = Core.el(`${prefix}_${i}_breaker`);
                const amps = breakerEl ? (parseInt(breakerEl.dataset.breakerAmps) || 0) : 0;

                if (amps === 0) continue;

                const conduit = p2b + b2u;
                if (installType.includes('_pvc')) {
                    add(installType.includes('concealed') ? '2.3' : '2.1', conduit);
                    add('13.1', 2);
                } else {
                    add('2.2', conduit); add('13.2', 2);
                }

                add('1.4', conduit);
                add('1.5', gnd);
                add('12.1', 1);

                if (amps <= 16) add('10.1', 1);
                else if (amps <= 20) add('10.2', 1);
                else add('10.3', 1);
            }
        });

        // 3. Legacy Inputs & Main Power
        if(Core.val('heater_units') > 0) add('7.1', Core.val('heater_units'));
        if(Core.val('ac_units') > 0) add('5.1', Core.val('ac_units'));

        const poles = Core.val('pole_count_7');
        const pHeight = Core.str('pole_height_7');
        if (poles > 0 && pHeight !== '0') {
            if (pHeight === '6.0') add('17.1', poles);
            else if (pHeight === '7.0') add('17.1-B', poles);
            else if (pHeight === '8.0') add('17.2', poles);
            else add('17.3', poles);
        }
        add('17.4-2', Core.val('rack_2_sets_7'));
        add('17.4-4', Core.val('rack_4_sets_7'));
        
        const mainDist = Core.val('main_ext_dist_7');
        if (mainDist > 0) add('17.5', mainDist); // รหัสพิเศษสำหรับสายเมน

        // 4. งานอื่นๆ (Service, Demo, EV)
        if (Core.isChecked('service_inspection')) add('8.1', 1);
        if (Core.isChecked('service_leak_find')) add('8.2', 1);
        if (Core.isChecked('service_trip_find')) add('8.3', 1);
        add('8.4', Core.val('service_lamp_replace'));

        add('19.1', Core.val('demo_lights_9'));
        add('19.2', Core.val('demo_outlets_9'));
        add('19.3', Core.val('demo_cables_9'));
        add('19.4', Core.val('demo_ac_9'));
        if (Core.isChecked('demo_include_repair_9')) add('19.5', Core.val('demo_lights_9') + Core.val('demo_outlets_9'));

        if (Core.isChecked('toggle_ev_charger_visibility')) {
            add('18.1', 1);
            if (Core.str('ev_install_type_8') === 'new_meter_tou') add('18.2', 1);
        }
        
        // CU & Ground
        const cuSize = Core.str('cu_replacement');
        if (cuSize && cuSize !== 'none') {
            const cuMap = { '4_slot': '9.1', '6_slot': '9.2', '8_slot': '9.3', '10_slot': '9.4', '12_slot': '9.5' };
            if (cuMap[cuSize]) add(cuMap[cuSize], 1);
        }
        if (Core.isChecked('install_ground')) add('6.1', 1);
        add('10.1', Core.val('mcb_16a'));
        add('10.2', Core.val('mcb_20a'));
        add('10.3', Core.val('mcb_32a'));

        return quantities;
    }
};

window.Electrical = Electrical;