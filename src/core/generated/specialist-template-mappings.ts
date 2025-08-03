/**
 * 自动生成的specialist模版映射文件
 * 
 * ⚠️ 警告: 此文件由构建脚本自动生成，请勿手动编辑！
 * 
 * 生成时间: 2025-08-03T10:42:32.344Z
 * 生成脚本: scripts/build-specialist-configs.ts
 * 
 * 用途: 为enabled的content specialist提供VSCode配置键名映射
 */

/**
 * Content specialist的模版配置映射
 * specialist_id -> VSCode配置键名（camelCase）
 */
export const SPECIALIST_TEMPLATE_MAPPINGS: Record<string, string> = {
  "adc_writer": "adcWriter",
  "fr_writer": "frWriter",
  "ifr_and_dar_writer": "ifrAndDarWriter",
  "nfr_writer": "nfrWriter",
  "overall_description_writer": "overallDescriptionWriter",
  "prototype_designer": "prototypeDesigner",
  "story_and_case_writer": "storyAndCaseWriter",
  "summary_writer": "summaryWriter",
  "user_journey_writer": "userJourneyWriter"
};

/**
 * 检查specialist是否支持模版配置
 */
export function isTemplateConfigSupported(specialistId: string): boolean {
  return specialistId in SPECIALIST_TEMPLATE_MAPPINGS;
}

/**
 * 获取specialist的VSCode配置键名
 */
export function getTemplateConfigKey(specialistId: string): string | undefined {
  return SPECIALIST_TEMPLATE_MAPPINGS[specialistId];
}

/**
 * 获取所有支持模版配置的specialist列表
 */
export function getSupportedTemplateSpecialists(): string[] {
  return Object.keys(SPECIALIST_TEMPLATE_MAPPINGS);
}
