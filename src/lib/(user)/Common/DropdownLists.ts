export type CodeValue = {
  code: string;
  value: string;
  opt1?: string;
  opt2?: string;
  opt3?: string;
  opt4?: string;
  opt5?: string;
  opt6?: string;
  opt7?: string;
  opt8?: string;
  opt9?: string;
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

export const TRAN_TYPE: CodeValueGroup = {
  title: "TRAN_TYPE / 거래 유형",
  list: [
    { code: "R01", value: "구매입고", opt1: "1", opt2: "1" },
    { code: "R02", value: "기타입고", opt1: "1", opt2: "1" },
    { code: "R03", value: "생산입고", opt1: "1", opt2: "2" },
    { code: "I01", value: "생산출고", opt1: "-1", opt2: "2" },
    { code: "I02", value: "기타출고", opt1: "-1", opt2: "1" },
    { code: "I03", value: "판매출고", opt1: "-1", opt2: "1" },
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
