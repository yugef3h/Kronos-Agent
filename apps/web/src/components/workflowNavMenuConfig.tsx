import type { DropdownMenuItem } from './DropdownMenu';

const WorkflowSpaceIcon = () => {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.75 6.75A2.75 2.75 0 0 1 7.5 4h9A2.75 2.75 0 0 1 19.25 6.75v10.5A2.75 2.75 0 0 1 16.5 20h-9a2.75 2.75 0 0 1-2.75-2.75V6.75Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 9.25h7M8.5 12h7M8.5 14.75h4.5" />
    </svg>
  );
};

const DraftIcon = () => {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 4.75h7.69a2 2 0 0 1 1.41.59l1.81 1.81a2 2 0 0 1 .59 1.41v8.69a2 2 0 0 1-2 2h-9.5a2 2 0 0 1-2-2v-10.5a2 2 0 0 1 2-2Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 14.75 5.75-5.75 1.5 1.5L10.5 16.25H9v-1.5Z" />
    </svg>
  );
};

export const workflowMenuItems: readonly DropdownMenuItem[] = [
  {
    to: '/workflow',
    label: 'Workflow 空间',
    description: '进入工作流应用视图',
    icon: <WorkflowSpaceIcon />,
    end: true,
  },
  {
    to: '/workflow?create=blank',
    label: '创建空白应用',
    description: '创建应用信息并初始化',
    icon: <DraftIcon />,
  },
];