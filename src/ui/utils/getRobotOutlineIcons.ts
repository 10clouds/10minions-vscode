import { ALL_MINION_ICONS_OUTLINE } from '../../constants';

export const getRobotOutlineIcons = () => {
  const randomIndex = Math.floor(
    Math.random() * ALL_MINION_ICONS_OUTLINE.length,
  );

  return [
    ALL_MINION_ICONS_OUTLINE[randomIndex],
    ALL_MINION_ICONS_OUTLINE[
      (randomIndex + 1) % ALL_MINION_ICONS_OUTLINE.length
    ],
  ];
};
