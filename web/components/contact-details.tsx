import { siteContact } from "@/lib/site-config";
export function ContactDetails() {
  return <p>Responsável: {siteContact.owner}. {siteContact.email
    ? <a href={`mailto:${siteContact.email}`}>{siteContact.email}</a>
    : <a href={siteContact.website} target="_blank" rel="noopener noreferrer">Site de Alexandre Boyago</a>}.</p>;
}
