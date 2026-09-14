/* Text a PERSON wrote — a tutor's bio, a class title, a review, a name.

   An Arabic page is an RTL container, and most Tunisian tutors write in French
   or in Derija with Latin letters. Without a direction of its own, a French bio
   inside that container keeps its letters in order but hands its neutral
   characters — guillemets, full stops, commas, colons — to the RTL flow, which
   moves them: "« … à ton rythme. »" rendered as "» … « .ton rythme" on 14 Sept.

   dir="auto" lets the browser take the direction from the first strong
   character, so a French bio reads LTR and an Arabic bio reads RTL inside the
   same page. It is set HERE, on one component, and not at call sites: the next
   free-text field someone adds is exactly where a sprinkled attribute gets
   forgotten.

   Use it for anything user-authored. Do NOT use it for our own copy — that
   already matches the page's locale. No "use client" and no hooks, so server
   and client components can both render it. */
import type { ComponentPropsWithoutRef, ElementType } from "react";

type UserTextProps<T extends ElementType> = { as?: T } & Omit<ComponentPropsWithoutRef<T>, "as" | "dir">;

export function UserText<T extends ElementType = "span">({ as, ...rest }: UserTextProps<T>) {
  const Tag: ElementType = as ?? "span";
  return <Tag {...rest} dir="auto" />;
}
