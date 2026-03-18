import { builtinRules } from "eslint/use-at-your-own-risk";

const objectShorthandRule = builtinRules.get("object-shorthand");

export default {
  meta: {
    name: "eslint-compat",
  },
  rules: {
    "object-shorthand": objectShorthandRule,
  },
};
