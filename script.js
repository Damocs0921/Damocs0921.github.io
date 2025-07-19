document.addEventListener('DOMContentLoaded', () => {
    const simulateButton = document.getElementById('simulateButton');
    const errorMessage = document.getElementById('errorMessage');
    const simulationTableHeadRow = document.getElementById('tableHeaderRow');
    const simulationTableBody = document.querySelector('#simulationTable tbody');

    const totalSimulationTime = 1500; // 秒
    const actionDistance = 10000;     // 米

    let simulationHistory = [];

    // --- 辅助函数：计算距离下次行动所需时间 ---
    function calculateTimeToNextAction(member) {
        if (member.currentSpeed <= 0) {
            return Infinity;
        }
        // 实时剩余距离 = 原始剩余距离 + 变化距离
        const effectiveRemainingDistance = Math.max(0, actionDistance - member.distanceCoveredSinceLastAction + member.deltaDistance);
        return effectiveRemainingDistance / member.currentSpeed;
    }

    // --- 辅助函数：计算实时剩余路程 ---
    function calculateRealtimeRemainingDistance(member) {
        return Math.max(0, actionDistance - member.distanceCoveredSinceLastAction + member.deltaDistance);
    }

    // --- 动态生成表头 ---
    function updateTableHeader(names) {
        simulationTableHeadRow.innerHTML = ''; // 清空现有表头

        // 固定列 (单位已移除)
        const timeHeader = document.createElement('th');
        timeHeader.textContent = '时间'; // 原 '时间 (秒)'
        simulationTableHeadRow.appendChild(timeHeader);

        const triggererHeader = document.createElement('th');
        triggererHeader.textContent = '行动者';
        simulationTableHeadRow.appendChild(triggererHeader);

        // 队员的动态列 (单位已移除)
        names.forEach(name => {
            // 速度相关列
            const baseSpeedHeader = document.createElement('th');
            baseSpeedHeader.textContent = `${name}原始速度`; // 原 `${name} 原始速度 (米/秒)`
            simulationTableHeadRow.appendChild(baseSpeedHeader);

            const deltaSpeedHeader = document.createElement('th');
            deltaSpeedHeader.textContent = `${name}变化速度`; // 原 `${name} 变化速度 (米/秒)`
            simulationTableHeadRow.appendChild(deltaSpeedHeader);

            const currentSpeedHeader = document.createElement('th');
            currentSpeedHeader.textContent = `${name}实时速度`; // 原 `${name} 实时速度 (米/秒)`
            simulationTableHeadRow.appendChild(currentSpeedHeader);

            // 剩余距离相关列
            const originalRemainingHeader = document.createElement('th');
            originalRemainingHeader.textContent = `${name}原始剩余距离`; // 原 `${name} 原始剩余距离 (米)`
            simulationTableHeadRow.appendChild(originalRemainingHeader);

            const deltaDistanceHeader = document.createElement('th');
            deltaDistanceHeader.textContent = `${name}变化距离`; // 原 `${name} 变化距离 (米)`
            simulationTableHeadRow.appendChild(deltaDistanceHeader);

            const realtimeRemainingHeader = document.createElement('th');
            realtimeRemainingHeader.textContent = `${name}实时剩余距离`; // 原 `${name} 实时剩余距离 (米)`
            simulationTableHeadRow.appendChild(realtimeRemainingHeader);
        });
    }


    // --- 添加表格行（或更新现有行） ---
    function renderTableRow(record, rowIndex) {
        let row;
        if (simulationTableBody.rows.length > rowIndex) {
            row = simulationTableBody.rows[rowIndex];
            row.innerHTML = '';
        } else {
            row = simulationTableBody.insertRow(rowIndex);
        }
        row.dataset.recordIndex = rowIndex;

        const cellTime = row.insertCell();
        cellTime.textContent = record.time.toFixed(2);

        const cellTriggerer = row.insertCell();
        cellTriggerer.textContent = record.triggererName;


        record.membersStateSnapshot.forEach((member, index) => {
            // 队员原始速度列 (只读)
            const baseSpeedCell = row.insertCell();
            baseSpeedCell.textContent = member.baseSpeed.toFixed(2);
            baseSpeedCell.classList.add('base-speed-display');

            // 队员变化速度列 (可编辑)
            const deltaSpeedCell = row.insertCell();
            const deltaSpeedInput = document.createElement('input');
            deltaSpeedInput.type = 'number';
            deltaSpeedInput.value = member.deltaSpeed.toFixed(2);
            deltaSpeedInput.step = "0.1";
            deltaSpeedInput.classList.add('delta-speed-input');
            deltaSpeedInput.dataset.memberIndex = index;
            deltaSpeedInput.dataset.rowIndex = rowIndex;

            deltaSpeedInput.addEventListener('change', (event) => {
                const newDeltaSpeed = parseFloat(event.target.value);
                const changedMemberIndex = parseInt(event.target.dataset.memberIndex);
                const changedRowIndex = parseInt(event.target.dataset.rowIndex);

                const currentBaseSpeed = simulationHistory[changedRowIndex].membersStateSnapshot[changedMemberIndex].baseSpeed;
                if (currentBaseSpeed + newDeltaSpeed <= 0) {
                    alert('实时速度必须大于0！请调整变化速度。');
                    const previousDeltaSpeed = simulationHistory[changedRowIndex].membersStateSnapshot[changedMemberIndex].deltaSpeed;
                    event.target.value = previousDeltaSpeed.toFixed(2);
                    return;
                }

                recalculateSimulationFromRow(changedRowIndex, {
                    type: 'deltaSpeed',
                    memberIndex: changedMemberIndex,
                    value: newDeltaSpeed
                });
            });
            deltaSpeedCell.appendChild(deltaSpeedInput);

            // 队员实时速度列 (只读)
            const currentSpeedCell = row.insertCell();
            currentSpeedCell.textContent = member.currentSpeed.toFixed(2);
            currentSpeedCell.classList.add('current-speed-display');

            // 队员原始剩余距离列 (只读)
            const originalRemainingCell = row.insertCell();
            originalRemainingCell.textContent = Math.max(0, actionDistance - member.distanceCoveredSinceLastAction).toFixed(2);
            originalRemainingCell.classList.add('original-remaining-display');

            // 队员变化距离列 (可编辑)
            const deltaDistanceCell = row.insertCell();
            const deltaDistanceInput = document.createElement('input');
            deltaDistanceInput.type = 'number';
            deltaDistanceInput.value = member.deltaDistance.toFixed(2);
            deltaDistanceInput.step = "0.1";
            deltaDistanceInput.classList.add('delta-distance-input');
            deltaDistanceInput.dataset.memberIndex = index;
            deltaDistanceInput.dataset.rowIndex = rowIndex;

            deltaDistanceInput.addEventListener('change', (event) => {
                const newDeltaDistance = parseFloat(event.target.value);
                const changedMemberIndex = parseInt(event.target.dataset.memberIndex);
                const changedRowIndex = parseInt(event.target.dataset.rowIndex);

                if (isNaN(newDeltaDistance)) { // 允许负值，但要确保是数字
                    alert('变化距离必须是数字！');
                    event.target.value = member.deltaDistance.toFixed(2); // 恢复原值
                    return;
                }

                // 检查实时剩余距离是否会变成负数（仅作提示，不强制阻止）
                const originalRemaining = Math.max(0, actionDistance - simulationHistory[changedRowIndex].membersStateSnapshot[changedMemberIndex].distanceCoveredSinceLastAction);
                if (originalRemaining + newDeltaDistance < 0 && originalRemaining > 0) {
                    alert('警告：这将导致实时剩余距离变为负数！');
                }

                recalculateSimulationFromRow(changedRowIndex, {
                    type: 'deltaDistance',
                    memberIndex: changedMemberIndex,
                    value: newDeltaDistance
                });
            });
            deltaDistanceCell.appendChild(deltaDistanceInput);

            // 队员实时剩余距离列 (只读)
            const realtimeRemainingCell = row.insertCell();
            realtimeRemainingCell.textContent = calculateRealtimeRemainingDistance(member).toFixed(2);
            realtimeRemainingCell.classList.add('realtime-remaining-display');


            // 高亮触发者相关列：如果当前队员是触发者，则将其所有数据列都加上高亮样式
            if (index === record.triggeredMemberIndex) {
                baseSpeedCell.classList.add('triggered-cell');
                deltaSpeedCell.classList.add('triggered-cell');
                currentSpeedCell.classList.add('triggered-cell');
                originalRemainingCell.classList.add('triggered-cell');
                deltaDistanceCell.classList.add('triggered-cell');
                realtimeRemainingCell.classList.add('triggered-cell');
            }
        });
    }

    // --- 模拟主函数：一次性计算所有事件 ---
    function runFullSimulation(initialMembersState, startTime = 0) {
        const records = [];
        let membersState = initialMembersState.map(m => ({ ...m })); // 确保是深拷贝
        let currentSimulationTime = startTime;

        while (currentSimulationTime < totalSimulationTime) {
            let nextActionTimes = membersState.map(m => calculateTimeToNextAction(m));

            let timeToNextAction = Math.min(...nextActionTimes);
            let triggeringMemberIndex = nextActionTimes.indexOf(timeToNextAction);

            if (timeToNextAction === Infinity || (timeToNextAction < 1e-9 && timeToNextAction !== 0)) {
                break;
            }

            if (currentSimulationTime + timeToNextAction > totalSimulationTime) {
                break;
            }

            // --- 更新所有队员的已移动距离和当前时间 ---
            for (let i = 0; i < membersState.length; i++) {
                if (timeToNextAction > 0) {
                    membersState[i].distanceCoveredSinceLastAction += membersState[i].currentSpeed * timeToNextAction;
                }
                // 确保已行驶距离不超过行动距离（在考虑deltaDistance后）
                const effectiveRemaining = actionDistance - membersState[i].distanceCoveredSinceLastAction + membersState[i].deltaDistance;
                if (effectiveRemaining <= 1e-9) { // 如果实时剩余距离接近或小于0
                    membersState[i].distanceCoveredSinceLastAction = actionDistance + membersState[i].deltaDistance; // 调整为已完成该行动
                }
            }
            currentSimulationTime += timeToNextAction;

            // --- 处理特殊行动事件 ---
            membersState[triggeringMemberIndex].distanceCoveredSinceLastAction = 0;
            membersState[triggeringMemberIndex].deltaDistance = 0; // 重置变化距离

            records.push({
                time: currentSimulationTime,
                eventType: "特殊行动",
                triggererName: membersState[triggeringMemberIndex].name,
                triggeredMemberIndex: triggeringMemberIndex,
                membersStateSnapshot: membersState.map(m => ({ ...m })) // 确保是深拷贝
            });
        }

        if (currentSimulationTime >= totalSimulationTime && records.length > 0 && records[records.length - 1].eventType !== "模拟结束") {
            records.push({
                time: totalSimulationTime,
                eventType: "模拟结束",
                triggererName: "无",
                triggeredMemberIndex: -1,
                membersStateSnapshot: records[records.length - 1].membersStateSnapshot
            });
        } else if (currentSimulationTime >= totalSimulationTime && records.length === 0 && startTime < totalSimulationTime) {
            records.push({
                time: totalSimulationTime,
                eventType: "模拟结束",
                triggererName: "无",
                triggeredMemberIndex: -1,
                membersStateSnapshot: initialMembersState.map(m => ({...m}))
            });
        }
        return records;
    }

    // --- 启动/重新启动整个模拟流程 ---
    function startOrRecalculateSimulation(isRecalculation = false, recalculationStartIndex = 0, recalculationInitialState = null) {
        errorMessage.textContent = '';

        let initialMembers = [];
        let memberNames = [];
        let simulationStartActualTime = 0;

        if (!isRecalculation) {
            for (let i = 1; i <= 4; i++) {
                const nameInput = document.getElementById(`name${i}`);
                const speedInput = document.getElementById(`speed${i}`);

                const name = nameInput.value.trim();
                const baseSpeed = parseFloat(speedInput.value);

                if (!name) {
                    errorMessage.textContent = `队员 ${i} 的姓名不能为空。`;
                    return;
                }
                if (isNaN(baseSpeed) || baseSpeed <= 0) {
                    errorMessage.textContent = `请输入队员 ${name} 的有效原始速度（大于0的数字）。`;
                    return;
                }
                initialMembers.push({
                    name: name,
                    baseSpeed: baseSpeed,
                    deltaSpeed: 0,
                    currentSpeed: baseSpeed,
                    distanceCoveredSinceLastAction: 0,
                    deltaDistance: 0 // 初始化为0
                });
                memberNames.push(name);
            }
            updateTableHeader(memberNames);

            simulationHistory = [{
                time: 0,
                eventType: "初始状态",
                triggererName: "无",
                triggeredMemberIndex: -1,
                membersStateSnapshot: initialMembers.map(m => ({ ...m }))
            }];
            simulationStartActualTime = 0;

        } else {
            initialMembers = recalculationInitialState;
            simulationStartActualTime = simulationHistory[recalculationStartIndex].time;
            memberNames = simulationHistory[0].membersStateSnapshot.map(m => m.name);
            updateTableHeader(memberNames);
        }

        const newRecords = runFullSimulation(initialMembers, simulationStartActualTime);

        const spliceIndex = isRecalculation ? recalculationStartIndex + 1 : 1;
        simulationHistory.splice(spliceIndex, simulationHistory.length - spliceIndex, ...newRecords);

        renderTable();
    }

    // --- 渲染整个表格 ---
    function renderTable() {
        simulationTableBody.innerHTML = '';
        simulationHistory.forEach((record, index) => {
            renderTableRow(record, index);
        });
    }

    // --- 从指定行重新计算模拟 (现在接受一个 changeDetails 对象) ---
    function recalculateSimulationFromRow(modifiedRowIndex, changeDetails) {
        if (modifiedRowIndex >= simulationHistory.length) {
            console.error("Attempted to recalculate from an invalid row index.");
            return;
        }

        const originalRecordOfModifiedRow = simulationHistory[modifiedRowIndex];
        const memberToModify = originalRecordOfModifiedRow.membersStateSnapshot[changeDetails.memberIndex];

        // --- 根据 changeDetails 的类型应用修改 ---
        if (changeDetails.type === 'deltaSpeed') {
            memberToModify.deltaSpeed = changeDetails.value;
            memberToModify.currentSpeed = memberToModify.baseSpeed + changeDetails.value;
        } else if (changeDetails.type === 'deltaDistance') {
            memberToModify.deltaDistance = changeDetails.value;
            // 注意：这里不修改 distanceCoveredSinceLastAction，因为它表示“已经行进的距离”。
            // deltaDistance 是对“剩余距离”的调整，会通过 calculateTimeToNextAction 影响后续计算。
        }
        // --- 修改结束 ---

        // 构建新的模拟起点状态 (深拷贝以避免后续修改影响原记录)
        const startMembersStateForSimulation = originalRecordOfModifiedRow.membersStateSnapshot.map(m => ({ ...m }));

        const simulationStartTime = originalRecordOfModifiedRow.time;

        const newSubsequentRecords = runFullSimulation(startMembersStateForSimulation, simulationStartTime);

        const preservedHistory = simulationHistory.slice(0, modifiedRowIndex + 1);
        simulationHistory = preservedHistory.concat(newSubsequentRecords);

        renderTable();
    }

    // --- 绑定初始按钮事件 ---
    simulateButton.addEventListener('click', () => {
        startOrRecalculateSimulation(false);
    });

    // --- 初始化按钮和输入框的默认值 ---
    document.getElementById('name1').value = '克拉拉';
    document.getElementById('speed1').value = '90';
    document.getElementById('name2').value = '停云';
    document.getElementById('speed2').value = '175';
    document.getElementById('name3').value = '驭空';
    document.getElementById('speed3').value = '163';
    document.getElementById('name4').value = '加拉赫';
    document.getElementById('speed4').value = '168';
});
