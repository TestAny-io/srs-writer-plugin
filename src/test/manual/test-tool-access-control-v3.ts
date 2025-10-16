/**
 * Manual Test for Tool Access Control v3.0
 * 
 * Run: npx ts-node src/test/manual/test-tool-access-control-v3.ts
 */

import { ToolAccessController } from '../../core/orchestrator/ToolAccessController';
import { ToolCacheManager } from '../../core/orchestrator/ToolCacheManager';
import { CallerType } from '../../types/index';

async function runTests() {
    console.log('='.repeat(80));
    console.log('Tool Access Control v3.0 Manual Test');
    console.log('='.repeat(80));

    const controller = new ToolAccessController();
    const cacheManager = new ToolCacheManager();

    const results = {
        callerTypeTests: false,
        callerNameTests: false,
        hybridTests: false,
        cacheTests: false,
        backwardCompatibility: false
    };

    // Test 1: CallerType-based access (v2.0 compatibility)
    console.log('\n[Test 1] CallerType-based access control');
    try {
        const tools1 = controller.getAvailableTools(CallerType.SPECIALIST_CONTENT);
        const tools2 = controller.getAvailableTools(CallerType.SPECIALIST_PROCESS);
        
        console.log(`  - SPECIALIST_CONTENT can access ${tools1.length} tools`);
        console.log(`  - SPECIALIST_PROCESS can access ${tools2.length} tools`);
        
        results.callerTypeTests = true;
        console.log('  ✅ PASS: CallerType-based access works');
    } catch (error) {
        console.log(`  ❌ FAIL: ${error}`);
    }

    // Test 2: CallerName-based access (v3.0 new feature)
    console.log('\n[Test 2] CallerName-based access control');
    try {
        const tools1 = controller.getAvailableTools(CallerType.SPECIALIST_CONTENT, 'prototype_designer');
        const tools2 = controller.getAvailableTools(CallerType.SPECIALIST_CONTENT, 'fr_writer');
        
        console.log(`  - prototype_designer can access ${tools1.length} tools`);
        console.log(`  - fr_writer can access ${tools2.length} tools`);
        
        // prototype_designer should have more tools (includes prototype-specific tools)
        if (tools1.length > tools2.length) {
            console.log(`  ✅ prototype_designer has ${tools1.length - tools2.length} more tools (specialist-specific)`);
            results.callerNameTests = true;
        } else {
            console.log(`  ❌ FAIL: Expected prototype_designer to have more tools`);
        }
    } catch (error) {
        console.log(`  ❌ FAIL: ${error}`);
    }

    // Test 3: Hybrid access control
    console.log('\n[Test 3] Hybrid access control (CallerType + CallerName)');
    try {
        // Test writeFile - accessible by SPECIALIST_PROCESS (type) and prototype_designer (name)
        const hasAccess1 = controller.validateAccess(CallerType.SPECIALIST_PROCESS, 'writeFile');
        const hasAccess2 = controller.validateAccess(CallerType.SPECIALIST_CONTENT, 'writeFile', 'prototype_designer');
        const hasAccess3 = controller.validateAccess(CallerType.SPECIALIST_CONTENT, 'writeFile', 'fr_writer');
        
        console.log(`  - SPECIALIST_PROCESS can access writeFile: ${hasAccess1}`);
        console.log(`  - prototype_designer can access writeFile: ${hasAccess2}`);
        console.log(`  - fr_writer can access writeFile: ${hasAccess3}`);
        
        if (hasAccess1 && hasAccess2 && !hasAccess3) {
            results.hybridTests = true;
            console.log('  ✅ PASS: Hybrid access control works correctly');
        } else {
            console.log('  ❌ FAIL: Hybrid access control not working as expected');
        }
    } catch (error) {
        console.log(`  ❌ FAIL: ${error}`);
    }

    // Test 4: Cache system with specialist ID
    console.log('\n[Test 4] Cache system with specialist ID');
    try {
        const cache1 = await cacheManager.getTools(CallerType.SPECIALIST_CONTENT, 'prototype_designer');
        const cache2 = await cacheManager.getTools(CallerType.SPECIALIST_CONTENT, 'fr_writer');
        const cache3 = await cacheManager.getTools(CallerType.SPECIALIST_CONTENT, 'prototype_designer'); // Should hit cache
        
        console.log(`  - Cache for prototype_designer: ${cache1.definitions.length} tools`);
        console.log(`  - Cache for fr_writer: ${cache2.definitions.length} tools`);
        console.log(`  - Cache hit test: ${cache3.definitions.length} tools`);
        
        if (cache1.definitions.length === cache3.definitions.length) {
            results.cacheTests = true;
            console.log('  ✅ PASS: Cache system works with specialist ID');
        } else {
            console.log('  ❌ FAIL: Cache inconsistency detected');
        }
    } catch (error) {
        console.log(`  ❌ FAIL: ${error}`);
    }

    // Test 5: Backward compatibility
    console.log('\n[Test 5] Backward compatibility (without specialist ID)');
    try {
        const tools = controller.getAvailableTools(CallerType.SPECIALIST_CONTENT);
        const validated = controller.validateAccess(CallerType.SPECIALIST_CONTENT, 'readFile');
        
        console.log(`  - Tools accessible without specialistId: ${tools.length}`);
        console.log(`  - validateAccess without specialistId: ${validated}`);
        
        if (tools.length > 0 && validated) {
            results.backwardCompatibility = true;
            console.log('  ✅ PASS: Backward compatibility maintained');
        } else {
            console.log('  ❌ FAIL: Backward compatibility broken');
        }
    } catch (error) {
        console.log(`  ❌ FAIL: ${error}`);
    }

    // Test 6: Access report generation
    console.log('\n[Test 6] Access report generation');
    try {
        const report1 = controller.generateAccessReport(CallerType.SPECIALIST_CONTENT);
        const report2 = controller.generateAccessReport(CallerType.SPECIALIST_CONTENT, 'prototype_designer');
        
        console.log(`  - Report without specialist ID (${report1.split('\n').length} lines)`);
        console.log(`  - Report with specialist ID (${report2.split('\n').length} lines)`);
        console.log('  ✅ PASS: Report generation works');
    } catch (error) {
        console.log(`  ❌ FAIL: ${error}`);
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('Test Summary');
    console.log('='.repeat(80));
    
    const passCount = Object.values(results).filter(v => v).length;
    const totalCount = Object.keys(results).length;
    
    Object.entries(results).forEach(([test, passed]) => {
        console.log(`  ${passed ? '✅' : '❌'} ${test}`);
    });
    
    console.log('\n' + `Overall: ${passCount}/${totalCount} tests passed`);
    
    if (passCount === totalCount) {
        console.log('\n🎉 All tests passed! v3.0 refactor is successful!');
        process.exit(0);
    } else {
        console.log('\n⚠️  Some tests failed. Please review the output above.');
        process.exit(1);
    }
}

runTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});

