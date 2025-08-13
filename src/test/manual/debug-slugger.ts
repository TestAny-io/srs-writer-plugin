/**
 * 调试github-slugger对中文的处理
 */

import GithubSlugger from 'github-slugger';

function testSlugger() {
  const slugger = new GithubSlugger();
  
  console.log('=== GitHub Slugger 中文测试 ===');
  
  const testTitles = [
    '项目文档',
    '概述', 
    '项目介绍',
    '需求分析',
    'Introduction',
    'Project Overview',
    '1. 引言',
    '1.1 目的'
  ];
  
  testTitles.forEach(title => {
    const slug = slugger.slug(title);
    console.log(`"${title}" -> "${slug}"`);
  });
  
  // 重置slugger再测试一遍
  console.log('\\n=== 重置后再次测试 ===');
  const slugger2 = new GithubSlugger();
  testTitles.forEach(title => {
    const slug = slugger2.slug(title);
    console.log(`"${title}" -> "${slug}"`);
  });
}

testSlugger();
