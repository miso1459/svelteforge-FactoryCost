export type CodeValue = {
  code: string;
  value: string;
};

export type CodeValueGroup = {
  title: string;
  list: CodeValue[];
};

export const ITEM_ACCT: CodeValueGroup = {
  title: "ITEM_ACCT / 품목 계정",
  list: [
    { code: "10", value: "제품" },
    { code: "20", value: "반제품" },
    { code: "30", value: "원자재" },
    { code: "40", value: "부자재" },
    { code: "50", value: "상품" },
  ],
};

export const UNIT: CodeValueGroup = {
  title: "UNIT / 단위",
  list: [
    { code: "EA", value: "EA" },
    { code: "Kg", value: "Kg" },
    { code: "g", value: "g" },
    { code: "l", value: "l" },
    { code: "ml", value: "ml" },
  ],
};
