import Link from 'next/link';
import { headers } from 'next/headers';
import { pickLocale } from '@/lib/locale';
import { siteContactEmail, siteOperatorName } from '@/lib/site-config';

// Rendered per request: the visitor's language comes from Accept-Language and
// the operator identity from the environment at request time, never at build.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Confidentialité · Privacy',
  description: 'Politique de confidentialité · Privacy policy',
};

// A content date, not config: bump it by hand whenever the policy TEXT changes.
const LAST_UPDATED = '2026-09-03';

// Every statement below is backed by the route and library code of this
// service (src/lib/events.ts, src/app/api/*, public/om-track.js). Keep the
// text in sync with that code when the collection changes.
export default async function PrivacyPage({ searchParams }) {
  const { lang } = await searchParams;
  const h = await headers();
  const locale = pickLocale(h.get('accept-language'), lang);
  const operator = siteOperatorName();
  const contact = siteContactEmail();

  return (
    <main lang={locale} className="mx-auto w-full max-w-3xl flex-1 px-6 py-10 leading-relaxed">
      <nav aria-label="Language" className="mb-8 flex gap-4 text-sm uppercase tracking-wide">
        <Link href="/privacy?lang=fr" className="underline">FR</Link>
        <Link href="/privacy?lang=en" className="underline">EN</Link>
      </nav>
      {locale === 'fr'
        ? <FrenchPolicy operator={operator} contact={contact} />
        : <EnglishPolicy operator={operator} contact={contact} />}
    </main>
  );
}

const H1 = 'mb-2 text-3xl font-semibold tracking-tight';
const H2 = 'mt-8 mb-3 text-xl font-semibold';
const P = 'mb-4';
const UL = 'mb-4 list-disc space-y-1 pl-6';
const CODE = 'rounded bg-black/10 px-1 font-mono text-[0.9em] dark:bg-white/10';

function Contact({ contact }) {
  if (!contact) return null;
  return <a href={`mailto:${contact}`} className="underline">{contact}</a>;
}

function FrenchPolicy({ operator, contact }) {
  return (
    <>
      <h1 className={H1}>Politique de confidentialité</h1>
      <p className="mb-6 text-sm opacity-70">Dernière mise à jour : {LAST_UPDATED}</p>

      <p className={P}>
        Ce service de mesure d&apos;audience est exploité par{' '}
        {operator ? <strong>{operator}</strong> : 'son exploitant'} (« nous »). Il ne s&apos;agit
        pas d&apos;un site que vous visitez : c&apos;est un outil de mesure appelé par nos autres
        sites et par nos publications sur les réseaux sociaux. Cette politique explique quels
        renseignements il enregistre, dans quelles situations, ce que nous en faisons et ce que
        nous n&apos;en faisons pas. Elle est rédigée pour être lue — pas pour être défilée.
      </p>

      <h2 className={H2}>Quand une mesure a lieu</h2>
      <p className={P}>Un événement est enregistré dans trois situations seulement :</p>
      <ul className={UL}>
        <li>
          <strong>Vue d&apos;un média.</strong> Une page de nos sites qui affiche un média inclut
          une image invisible d&apos;un pixel (<code className={CODE}>/api/track/&lt;identifiant&gt;</code>).
          Son chargement par votre navigateur compte comme une vue.
        </li>
        <li>
          <strong>Clic sur un lien suivi.</strong> Les liens de nos publications sociales passent
          par <code className={CODE}>/m/&lt;identifiant&gt;</code>, qui enregistre le clic et sa
          provenance (le réseau indiqué dans le lien), puis vous redirige vers le média.
        </li>
        <li>
          <strong>Lecture d&apos;une vidéo.</strong> Sur nos sites, un petit script
          (<code className={CODE}>om-track.js</code>) signale au service la mise en lecture, la
          pause, la fin et le franchissement de 25 %, 50 %, 75 % et 100 % d&apos;une vidéo.
        </li>
      </ul>

      <h2 className={H2}>Ce que nous enregistrons</h2>
      <p className={P}>Pour chaque événement, une ligne est ajoutée à notre base de données avec :</p>
      <ul className={UL}>
        <li>l&apos;identifiant du média concerné et la date et l&apos;heure ;</li>
        <li>
          votre <strong>adresse IP</strong>, telle que transmise par notre hébergeur, ainsi que le
          pays, la région et la ville que l&apos;hébergeur en déduit ;
        </li>
        <li>
          la chaîne d&apos;identification de votre navigateur (<em>user agent</em>) et, dérivés
          de celle-ci, le type d&apos;appareil (mobile, tablette, ordinateur), le système
          d&apos;exploitation, le navigateur et un indicateur robot/humain ;
        </li>
        <li>la page d&apos;origine (<em>referer</em>) et votre langue préférée telle que déclarée par le navigateur ;</li>
        <li>la source indiquée dans le lien (paramètre <code className={CODE}>s</code> ou <code className={CODE}>utm_source</code>), le cas échéant ;</li>
        <li>
          pour la lecture vidéo : le type d&apos;événement, la position et la durée de la vidéo,
          et un identifiant de session aléatoire, généré par votre navigateur et conservé dans sa
          mémoire de session uniquement (il disparaît à la fermeture de l&apos;onglet).
        </li>
      </ul>
      <p className={P}>
        Ce service ne dépose <strong>aucun témoin (cookie)</strong> et ne recueille ni nom, ni
        adresse courriel, ni aucune donnée de compte. Aucun outil d&apos;analyse tiers
        n&apos;est utilisé.
      </p>

      <h2 className={H2}>À quoi cela sert</h2>
      <p className={P}>
        Uniquement à mesurer l&apos;audience de nos propres médias : nombre de vues et de clics,
        répartition par réseau d&apos;origine, par appareil et par pays, lectures et taux de
        complétion des vidéos, nombre d&apos;adresses IP distinctes. Les événements identifiés
        comme provenant de robots sont exclus de ces statistiques par défaut.
      </p>

      <h2 className={H2}>Ce que nous n&apos;en faisons pas</h2>
      <p className={P}>
        Nous ne vendons pas ces renseignements. Nous ne les partageons pas à des fins
        publicitaires. Nous ne les croisons pas avec d&apos;autres données pour vous identifier.
        Nous n&apos;enregistrons rien d&apos;autre que ce qui est décrit ci-dessus.
      </p>

      <h2 className={H2}>Qui y a accès, et pour combien de temps</h2>
      <p className={P}>
        Les données ne sont lisibles qu&apos;au moyen d&apos;un secret administrateur détenu par
        l&apos;exploitant. Aucune interface publique ne permet de consulter les événements.
      </p>
      <p className={P}>
        Aucune suppression automatique n&apos;est en place : les événements sont conservés
        jusqu&apos;à ce que leur suppression soit demandée (voir « Vos droits ») ou que nous
        les effacions nous-mêmes.
      </p>

      <h2 className={H2}>Hébergement</h2>
      <p className={P}>
        Le service est hébergé sur Vercel, qui fournit la localisation géographique déduite de
        l&apos;adresse IP ; la base de données est hébergée chez Turso. Les vidéos elles-mêmes
        sont diffusées par Bunny.net, dont le lecteur est chargé directement par votre
        navigateur. Ces fournisseurs peuvent tenir des journaux techniques conformément à leurs
        propres politiques.
      </p>

      <h2 className={H2}>Vos droits (Loi 25, Québec)</h2>
      <p className={P}>
        Vous pouvez demander l&apos;accès aux renseignements qui vous concernent, leur
        rectification ou leur suppression, et retirer votre consentement à tout moment.
        {contact ? (
          <>
            {' '}Écrivez à <Contact contact={contact} /> — nous répondrons dans les 30 jours.
            La personne responsable de la protection des renseignements personnels est
            l&apos;exploitant du service, joignable à cette même adresse.
          </>
        ) : null}
        {' '}Comme nous ne conservons ni nom ni courriel, indiquez dans votre demande les
        éléments qui permettent de retrouver vos événements (par exemple votre adresse IP et
        la période concernée).
      </p>

      <h2 className={H2}>Modifications</h2>
      <p className={P}>
        Toute modification de cette politique sera affichée ici avec sa date. Si un changement
        touche ce que nous recueillons, il ne s&apos;appliquera pas rétroactivement aux données
        déjà enregistrées sans votre consentement.
      </p>
    </>
  );
}

function EnglishPolicy({ operator, contact }) {
  return (
    <>
      <h1 className={H1}>Privacy Policy</h1>
      <p className="mb-6 text-sm opacity-70">Last updated: {LAST_UPDATED}</p>

      <p className={P}>
        This audience-measurement service is operated by{' '}
        {operator ? <strong>{operator}</strong> : 'its operator'} (&quot;we&quot;). It is not a
        site you visit: it is a measurement tool called by our other sites and by our posts on
        social networks. This policy explains what it records, in which situations, what we do
        with it, and what we do not do. It is written to be read — not scrolled past.
      </p>

      <h2 className={H2}>When a measurement happens</h2>
      <p className={P}>An event is recorded in three situations only:</p>
      <ul className={UL}>
        <li>
          <strong>Viewing a media.</strong> A page on our sites that displays a media includes an
          invisible one-pixel image (<code className={CODE}>/api/track/&lt;id&gt;</code>). Your
          browser loading it counts as a view.
        </li>
        <li>
          <strong>Clicking a tracked link.</strong> Links in our social posts go through{' '}
          <code className={CODE}>/m/&lt;id&gt;</code>, which records the click and its origin
          (the network named in the link), then redirects you to the media.
        </li>
        <li>
          <strong>Playing a video.</strong> On our sites, a small script
          (<code className={CODE}>om-track.js</code>) reports play, pause, end, and the
          crossing of 25%, 50%, 75% and 100% of a video to the service.
        </li>
      </ul>

      <h2 className={H2}>What we record</h2>
      <p className={P}>For each event, one row is added to our database with:</p>
      <ul className={UL}>
        <li>the identifier of the media concerned, and the date and time;</li>
        <li>
          your <strong>IP address</strong>, as forwarded by our hosting provider, together with
          the country, region and city the provider derives from it;
        </li>
        <li>
          your browser&apos;s identification string (<em>user agent</em>) and, derived from it,
          the device type (mobile, tablet, desktop), operating system, browser, and a bot/human
          flag;
        </li>
        <li>the originating page (<em>referer</em>) and your preferred language as declared by the browser;</li>
        <li>the source named in the link (<code className={CODE}>s</code> or <code className={CODE}>utm_source</code> parameter), when present;</li>
        <li>
          for video playback: the event type, the position and duration of the video, and a
          random session identifier generated by your browser and kept in its session storage
          only (it disappears when the tab is closed).
        </li>
      </ul>
      <p className={P}>
        This service sets <strong>no cookies</strong> and collects no name, no email address and
        no account data. No third-party analytics tool is used.
      </p>

      <h2 className={H2}>What it is used for</h2>
      <p className={P}>
        Solely to measure the audience of our own media: number of views and clicks, breakdown by
        originating network, device and country, video plays and completion rates, number of
        distinct IP addresses. Events identified as coming from bots are excluded from these
        statistics by default.
      </p>

      <h2 className={H2}>What we don&apos;t do</h2>
      <p className={P}>
        We do not sell this information. We do not share it for advertising. We do not combine it
        with other data to identify you. We record nothing beyond what is described above.
      </p>

      <h2 className={H2}>Who can read it, and for how long</h2>
      <p className={P}>
        The data can only be read with an administrator secret held by the operator. No public
        interface exposes the events.
      </p>
      <p className={P}>
        No automatic deletion is in place: events are kept until their deletion is requested (see
        &quot;Your rights&quot;) or until we erase them ourselves.
      </p>

      <h2 className={H2}>Hosting</h2>
      <p className={P}>
        The service is hosted on Vercel, which supplies the geographic location derived from the
        IP address; the database is hosted by Turso. The videos themselves are delivered by
        Bunny.net, whose player is loaded directly by your browser. These providers may keep
        technical logs under their own policies.
      </p>

      <h2 className={H2}>Your rights (Law 25, Québec)</h2>
      <p className={P}>
        You may request access to the information concerning you, its correction or deletion, and
        withdraw consent at any time.
        {contact ? (
          <>
            {' '}Write to <Contact contact={contact} /> — we will answer within 30 days. The person
            responsible for the protection of personal information is the service operator,
            reachable at that same address.
          </>
        ) : null}
        {' '}Since we keep neither name nor email, include in your request what allows us to find
        your events (for example your IP address and the period concerned).
      </p>

      <h2 className={H2}>Changes</h2>
      <p className={P}>
        Any change to this policy will be posted here with its date. A change affecting what we
        collect will not apply retroactively to data already recorded without your consent.
      </p>
    </>
  );
}
