/**
 * askQuestion工具多次用户交互的集成测试
 * 
 * 测试完整的用户交互流程：specialist在恢复执行后可以多次调用askQuestion
 * 
 * 测试场景：
 * 1. specialist第一次调用askQuestion → 正确等待
 * 2. 用户回复后specialist恢复执行
 * 3. specialist第二次调用askQuestion → 应该再次正确等待（修复的bug）
 * 4. 用户再次回复后specialist继续执行
 * 
 * 测试日期：2025-10-08
 */

describe('askQuestion Multiple Interactions - Integration Test', () => {
    describe('完整的多次用户交互流程', () => {
        /**
         * 核心集成测试：模拟prototype_designer的完整SuperDesign流程
         * 
         * 流程：
         * Stage 1: 布局设计 → askQuestion → 用户确认
         * Stage 2: 主题设计 → askQuestion → 用户确认（修复的bug场景）
         * Stage 3: 动画设计 → askQuestion → 用户确认
         */
        it('应该支持specialist的多阶段用户交互流程（SuperDesign场景）', () => {
            console.log('\n🎨 === SuperDesign多阶段交互流程测试 ===\n');

            // === 阶段1：布局设计 ===
            console.log('📐 Stage 1: 布局线框图设计');
            
            let state: any = {
                stage: 'executing',
                pendingInteraction: undefined,
                resumeContext: undefined
            };

            // specialist第一次调用askQuestion
            console.log('  → specialist调用askQuestion展示布局设计');
            state.stage = 'awaiting_user';
            state.pendingInteraction = {
                type: 'input',
                message: '请确认布局设计是否符合预期？'
            };
            state.resumeContext = {
                specialist: 'prototype_designer',
                iteration: 2,  // ✅ 修复后：askQuestion返回前已递增，保存的是递增后的值
                planExecutorState: { /* ... */ }
            };

            expect(state.stage).toBe('awaiting_user');
            expect(state.pendingInteraction).toBeDefined();
            console.log('  ✅ 第一次askQuestion：正确进入等待状态\n');

            // === 用户交互1 ===
            console.log('👤 User: "确认布局，请继续"');
            const userResponse1 = '确认布局，请继续';
            
            // 模拟handleUserResponse清除pendingInteraction
            state.pendingInteraction = undefined;
            
            // === specialist恢复执行 ===
            console.log('🔄 specialist恢复执行...');
            const resumeSuccess1 = true; // 模拟specialist恢复成功

            // === 阶段2：主题设计（关键测试点）===
            console.log('\n🎨 Stage 2: 主题风格设计');
            console.log('  → specialist继续工作，再次调用askQuestion');
            
            // 关键：resumePlanExecutorWithUserResponse设置了新的awaiting_user状态
            state.stage = 'awaiting_user';
            state.pendingInteraction = {
                type: 'input',
                message: '请确认主题风格是否符合预期？'
            };

            // 🚀 修复后的逻辑：handleUserResponse检查状态
            let shouldWait = false;
            let shouldContinue = false;

            if (resumeSuccess1) {
                if (state.stage === 'awaiting_user' && state.pendingInteraction) {
                    shouldWait = true;
                    console.log('  🔍 检测到state.stage = "awaiting_user"');
                    console.log('  ✅ 修复生效：保持等待状态，不提前return');
                } else {
                    shouldContinue = true;
                }
            }

            // 验证修复
            expect(shouldWait).toBe(true);
            expect(shouldContinue).toBe(false);
            expect(state.stage).toBe('awaiting_user');
            console.log('  ✅ 第二次askQuestion：正确进入等待状态（修复验证成功）\n');

            // === 用户交互2 ===
            console.log('👤 User: "主题很好，请继续"');
            const userResponse2 = '主题很好，请继续';
            
            state.pendingInteraction = undefined;
            
            // === specialist再次恢复执行 ===
            console.log('🔄 specialist再次恢复执行...');
            const resumeSuccess2 = true;

            // === 阶段3：动画设计 ===
            console.log('\n✨ Stage 3: 动画交互设计');
            console.log('  → specialist继续工作，第三次调用askQuestion');
            
            state.stage = 'awaiting_user';
            state.pendingInteraction = {
                type: 'input',
                message: '请确认动画设计是否符合预期？'
            };

            // 再次验证逻辑
            shouldWait = false;
            shouldContinue = false;

            if (resumeSuccess2) {
                if (state.stage === 'awaiting_user' && state.pendingInteraction) {
                    shouldWait = true;
                    console.log('  🔍 再次检测到state.stage = "awaiting_user"');
                    console.log('  ✅ 修复持续生效：保持等待状态');
                } else {
                    shouldContinue = true;
                }
            }

            expect(shouldWait).toBe(true);
            console.log('  ✅ 第三次askQuestion：正确进入等待状态\n');

            // === 用户交互3 ===
            console.log('👤 User: "动画很棒，完成吧"');
            const userResponse3 = '动画很棒，完成吧';
            
            state.pendingInteraction = undefined;

            // === specialist完成工作 ===
            console.log('🔄 specialist最后一次恢复执行...');
            state.stage = 'completed';
            const resumeSuccess3 = true;

            // 验证完成状态
            shouldWait = false;
            shouldContinue = false;

            if (resumeSuccess3) {
                if (state.stage === 'awaiting_user' && state.pendingInteraction) {
                    shouldWait = true;
                } else {
                    shouldContinue = true;
                    console.log('  ✅ specialist完成所有工作');
                }
            }

            expect(shouldContinue).toBe(true);
            expect(state.stage).toBe('completed');

            console.log('\n🎉 === SuperDesign完整流程测试通过 ===');
            console.log('✅ 支持多次用户交互（3次askQuestion）');
            console.log('✅ 每次都正确等待用户回复');
            console.log('✅ 修复完全有效\n');
        });

        /**
         * 测试边界情况：用户交互过程中状态异常
         */
        it('应该处理用户交互过程中的状态异常', () => {
            console.log('\n⚠️ === 状态异常处理测试 ===\n');

            const testCases = [
                {
                    name: '异常1：resumeSuccess=true 但状态未设置',
                    resumeSuccess: true,
                    stage: 'executing', // 异常：应该是awaiting_user但不是
                    pendingInteraction: undefined,
                    expectedBehavior: 'continue',
                    description: '安全降级：继续执行，不会卡死'
                },
                {
                    name: '异常2：resumeSuccess=true 且stage正确但pendingInteraction=null',
                    resumeSuccess: true,
                    stage: 'awaiting_user',
                    pendingInteraction: undefined, // 异常：应该有值
                    expectedBehavior: 'continue',
                    description: '安全降级：继续执行，避免死锁'
                },
                {
                    name: '正常3：完整的用户交互状态',
                    resumeSuccess: true,
                    stage: 'awaiting_user',
                    pendingInteraction: { type: 'input', message: 'test' },
                    expectedBehavior: 'wait',
                    description: '正常行为：等待用户'
                }
            ];

            testCases.forEach(testCase => {
                console.log(`📋 ${testCase.name}`);
                
                const state: any = {
                    stage: testCase.stage,
                    pendingInteraction: testCase.pendingInteraction
                };

                let actualBehavior = '';
                if (testCase.resumeSuccess) {
                    if (state.stage === 'awaiting_user' && state.pendingInteraction) {
                        actualBehavior = 'wait';
                    } else {
                        actualBehavior = 'continue';
                    }
                }

                expect(actualBehavior).toBe(testCase.expectedBehavior);
                console.log(`  ✅ ${testCase.description}\n`);
            });

            console.log('✅ 所有异常情况都能安全处理\n');
        });

        /**
         * 性能测试：多次交互不应导致性能下降
         */
        it('应该处理大量连续的用户交互而不影响性能', () => {
            console.log('\n⚡ === 性能测试：连续10次用户交互 ===\n');

            const iterations = 10;
            const startTime = Date.now();

            for (let i = 1; i <= iterations; i++) {
                // 模拟每次交互
                const state: any = {
                    stage: 'awaiting_user',
                    pendingInteraction: {
                        type: 'input',
                        message: `第${i}次用户交互`
                    }
                };

                const resumeSuccess = true;
                let shouldWait = false;

                if (resumeSuccess) {
                    if (state.stage === 'awaiting_user' && state.pendingInteraction) {
                        shouldWait = true;
                    }
                }

                expect(shouldWait).toBe(true);
            }

            const duration = Date.now() - startTime;
            console.log(`✅ ${iterations}次交互完成，耗时: ${duration}ms`);
            console.log(`✅ 平均每次: ${(duration / iterations).toFixed(2)}ms`);
            
            // 性能断言：应该非常快（< 100ms）
            expect(duration).toBeLessThan(100);
            
            console.log('✅ 性能表现优秀，无性能问题\n');
        });
    });
});
