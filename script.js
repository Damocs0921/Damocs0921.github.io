document.addEventListener('DOMContentLoaded', () => {
    const simulateButton = document.getElementById('simulateButton');
    const exportExcelButton = document.getElementById('exportExcelButton'); // 获取导出按钮
    const errorMessage = document.getElementById('errorMessage');
    const simulationTableHeadRow = document.getElementById('tableHeaderRow');
    const simulationTableBody = document.querySelector('#simulationTable tbody');
    const totalSimulationTimeInput = document.getElementById('totalSimulationTimeInput'); // 新增：获取总模拟时间输入框

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
        timeHeader.textContent = '时间';
        simulationTableHeadRow.appendChild(timeHeader);

        const triggererHeader = document.createElement('th');
        triggererHeader.textContent = '行动者';
        simulationTableHeadRow.appendChild(triggererHeader);

        // 队员的动态列 (单位已移除)
        names.forEach(name => {
            // 速度相关列
            const baseSpeedHeader = document.createElement('th');
            baseSpeedHeader.textContent = `${name}原始速度`;
            simulationTableHeadRow.appendChild(baseSpeedHeader);

            const deltaSpeedHeader = document.createElement('th');
            deltaSpeedHeader.textContent = `${name}变化速度`;
            simulationTableHeadRow.appendChild(deltaSpeedHeader);

            const currentSpeedHeader = document.createElement('th');
            currentSpeedHeader.textContent = `${name}实时速度`;
            simulationTableHeadRow.appendChild(currentSpeedHeader);

            // 剩余距离相关列
            const originalRemainingHeader = document.createElement('th');
            originalRemainingHeader.textContent = `${name}原始剩余距离`;
            simulationTableHeadRow.appendChild(originalRemainingHeader);

            const deltaDistanceHeader = document.createElement('th');
            deltaDistanceHeader.textContent = `${name}变化距离`;
            simulationTableHeadRow.appendChild(deltaDistanceHeader);

            const realtimeRemainingHeader = document.createElement('th');
            realtimeRemainingHeader.textContent = `${name}实时剩余距离`;
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
            deltaSpeedInput.step = "1";
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
    function runFullSimulation(initialMembersState, startTime = 0, currentTotalSimulationTime) { // 接收总模拟时间参数
        const records = [];
        let membersState = initialMembersState.map(m => ({ ...m })); // 确保是深拷贝
        let currentSimulationTime = startTime;

        while (currentSimulationTime < currentTotalSimulationTime) { // 使用传入的总模拟时间
            let nextActionTimes = membersState.map(m => calculateTimeToNextAction(m));

            let timeToNextAction = Math.min(...nextActionTimes);
            let triggeringMemberIndex = nextActionTimes.indexOf(timeToNextAction);

            if (timeToNextAction === Infinity || (timeToNextAction < 1e-9 && timeToNextAction !== 0)) {
                break;
            }

            if (currentSimulationTime + timeToNextAction > currentTotalSimulationTime) { // 使用传入的总模拟时间
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

        if (currentSimulationTime >= currentTotalSimulationTime && records.length > 0 && records[records.length - 1].eventType !== "模拟结束") { // 使用传入的总模拟时间
            records.push({
                time: currentTotalSimulationTime, // 使用传入的总模拟时间
                eventType: "模拟结束",
                triggererName: "无",
                triggeredMemberIndex: -1,
                membersStateSnapshot: records[records.length - 1].membersStateSnapshot
            });
        } else if (currentSimulationTime >= currentTotalSimulationTime && records.length === 0 && startTime < currentTotalSimulationTime) { // 使用传入的总模拟时间
            records.push({
                time: currentTotalSimulationTime, // 使用传入的总模拟时间
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

        const currentTotalSimulationTime = parseFloat(totalSimulationTimeInput.value); // 获取总模拟时间

        if (isNaN(currentTotalSimulationTime) || currentTotalSimulationTime <= 0) {
            errorMessage.textContent = '请输入有效的总模拟时间（大于0的数字）。';
            return;
        }

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

        const newRecords = runFullSimulation(initialMembers, simulationStartActualTime, currentTotalSimulationTime); // 传递总模拟时间

        const spliceIndex = isRecalculation ? recalculationStartIndex + 1 : 1;
        simulationHistory.splice(spliceIndex, simulationHistory.length - spliceIndex, ...newRecords);

        renderTable();
        saveSimulationState(); // 模拟或重算后保存状态
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
        const currentTotalSimulationTime = parseFloat(totalSimulationTimeInput.value); // 获取当前的总模拟时间

        const newSubsequentRecords = runFullSimulation(startMembersStateForSimulation, simulationStartTime, currentTotalSimulationTime); // 传递总模拟时间

        const preservedHistory = simulationHistory.slice(0, modifiedRowIndex + 1);
        simulationHistory = preservedHistory.concat(newSubsequentRecords);

        renderTable();
        saveSimulationState(); // 模拟或重算后保存状态
    }

    // --- 导出表格数据到 CSV ---
    function exportTableToCsv(filename) {
        if (simulationHistory.length <= 1) { // 只有初始状态或无数据
            alert('没有模拟数据可以导出。请先运行模拟。');
            return;
        }

        const headers = [];
        // 获取表头
        Array.from(simulationTableHeadRow.children).forEach(th => {
            headers.push(`"${th.textContent.replace(/"/g, '""')}"`); // 确保双引号和转义
        });
        const csvRows = [];
        csvRows.push(headers.join(','));

        // 遍历模拟历史数据，构建CSV行
        for (let i = 0; i < simulationHistory.length; i++) {
            const record = simulationHistory[i];
            const rowData = [];

            // 固定列数据
            rowData.push(record.time.toFixed(2));
            rowData.push(`"${record.triggererName.replace(/"/g, '""')}"`);

            // 队员的动态数据
            record.membersStateSnapshot.forEach(member => {
                rowData.push(member.baseSpeed.toFixed(2));
                rowData.push(member.deltaSpeed.toFixed(2));
                rowData.push(member.currentSpeed.toFixed(2));
                rowData.push(Math.max(0, actionDistance - member.distanceCoveredSinceLastAction).toFixed(2));
                rowData.push(member.deltaDistance.toFixed(2));
                rowData.push(calculateRealtimeRemainingDistance(member).toFixed(2));
            });
            csvRows.push(rowData.join(','));
        }

        const csvString = '\uFEFF' + csvRows.join('\n'); // 添加BOM以支持中文
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click(); // 触发下载
        URL.revokeObjectURL(link.href); // 释放URL对象
    }

    // --- 缓存功能：保存模拟状态 ---
    function saveSimulationState() {
        try {
            const currentMembersInput = [];
            for (let i = 1; i <= 4; i++) {
                currentMembersInput.push({
                    name: document.getElementById(`name${i}`).value,
                    speed: parseFloat(document.getElementById(`speed${i}`).value)
                });
            }

            const stateToSave = {
                simulationHistory: simulationHistory,
                initialInputs: {
                    members: currentMembersInput,
                    totalSimulationTime: parseFloat(totalSimulationTimeInput.value)
                }
            };
            localStorage.setItem('hsrSimulationState', JSON.stringify(stateToSave));
            console.log("Simulation state saved.");
        } catch (e) {
            console.error("Error saving simulation state:", e);
            errorMessage.textContent = '保存模拟状态失败。可能浏览器存储已满。';
        }
    }

    // --- 缓存功能：加载模拟状态 ---
    function loadSimulationState() {
        try {
            const savedState = localStorage.getItem('hsrSimulationState');
            if (savedState) {
                const parsedState = JSON.parse(savedState);

                // 恢复输入框内容
                parsedState.initialInputs.members.forEach((member, i) => {
                    const nameInput = document.getElementById(`name${i + 1}`);
                    const speedInput = document.getElementById(`speed${i + 1}`);
                    if (nameInput) nameInput.value = member.name;
                    if (speedInput) speedInput.value = member.speed;
                });
                if (totalSimulationTimeInput) {
                    totalSimulationTimeInput.value = parsedState.initialInputs.totalSimulationTime;
                }

                // 恢复模拟历史
                simulationHistory = parsedState.simulationHistory;

                // 重新渲染表格和表头
                if (simulationHistory.length > 0) {
                    const memberNames = simulationHistory[0].membersStateSnapshot.map(m => m.name);
                    updateTableHeader(memberNames);
                    renderTable();
                    console.log("Simulation state loaded.");
                } else {
                    // 如果历史是空的（比如只保存了初始输入），则设置默认值
                    setInitialDefaultValues();
                }
            } else {
                setInitialDefaultValues();
            }
        } catch (e) {
            console.error("Error loading simulation state:", e);
            errorMessage.textContent = '加载模拟状态失败。缓存数据可能已损坏。';
            setInitialDefaultValues(); // 加载失败时使用默认值
        }
    }

    // --- 初始化输入框的默认值 ---
    function setInitialDefaultValues() {
        document.getElementById('name1').value = '克拉拉';
        document.getElementById('speed1').value = '90';
        document.getElementById('name2').value = '停云';
        document.getElementById('speed2').value = '175';
        document.getElementById('name3').value = '驭空';
        document.getElementById('speed3').value = '163';
        document.getElementById('name4').value = '加拉赫';
        document.getElementById('speed4').value = '168';
        // 确保总模拟时间也有默认值，如果缓存中没有
        if (!totalSimulationTimeInput.value) {
            totalSimulationTimeInput.value = '550';
        }
    }


    // --- 绑定初始按钮事件 ---
    simulateButton.addEventListener('click', () => {
        startOrRecalculateSimulation(false);
    });

    // --- 绑定导出按钮事件 ---
    exportExcelButton.addEventListener('click', () => {
        const date = new Date();
        const filename = `HSR排轴模拟结果_${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}_${date.getHours().toString().padStart(2, '0')}${date.getMinutes().toString().padStart(2, '0')}.csv`;
        exportTableToCsv(filename);
    });

    // 在页面加载时尝试加载缓存状态
    loadSimulationState();
});
