import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Heart } from "lucide-react";

type Scholar = {
  name: string;
  org: string;
  link?: string;
};

type ScholarGroup = {
  id: string;
  icon: string;
  title: string;
  subtitle?: string;
  scholars: Scholar[];
};

const GROUPS: ScholarGroup[] = [
  {
    id: "contemporary",
    icon: "🌿",
    title: "Contemporary Voices",
    scholars: [
      { name: "Charles H. Spurgeon", org: "spurgeon.org", link: "https://www.spurgeon.org" },
      { name: "Walter Brueggemann", org: "workingpreacher.org", link: "https://www.workingpreacher.org" },
      { name: "N. T. Wright", org: "ntwrightonline.org", link: "https://ntwrightonline.org" },
      { name: "Ajith Fernando", org: "Youth for Christ Sri Lanka", link: "https://yfcsl.org" },
      { name: "Elsa Tamez", org: "Latin American Biblical University", link: "https://ubla.edu.mx" },
      { name: "Gustavo Gutiérrez", org: "Dominican Order" },
      { name: "John Mbiti", org: "African theology" },
      { name: "C. S. Song", org: "Asian contextual theology" },
    ],
  },
  {
    id: "global-historic",
    icon: "🌍",
    title: "Global & Historic Church Fathers",
    subtitle: "Include support links where available",
    scholars: [
      { name: "Origen", org: "ccel.org", link: "https://www.ccel.org" },
      { name: "Augustine of Hippo", org: "newadvent.org", link: "https://www.newadvent.org" },
      { name: "John Chrysostom", org: "newadvent.org", link: "https://www.newadvent.org" },
      { name: "Thomas Aquinas", org: "aquinas.cc", link: "https://aquinas.cc" },
      { name: "Irenaeus", org: "newadvent.org", link: "https://www.newadvent.org" },
      { name: "Tertullian", org: "tertullian.org", link: "https://www.tertullian.org" },
      { name: "Athanasius", org: "newadvent.org", link: "https://www.newadvent.org" },
      { name: "Cyril of Alexandria", org: "newadvent.org", link: "https://www.newadvent.org" },
      { name: "Theodoret of Cyrus", org: "ccel.org", link: "https://www.ccel.org" },
    ],
  },
  {
    id: "reformation",
    icon: "🔥",
    title: "Reformation Voices",
    subtitle: "Include support links where available",
    scholars: [
      { name: "Martin Luther", org: "ccel.org", link: "https://www.ccel.org" },
      { name: "John Calvin", org: "Honour Only" },
      { name: "John Wesley", org: "Honour Only" },
      { name: "Huldrych Zwingli", org: "Honour Only" },
      { name: "William Tyndale", org: "Honour Only" },
      { name: "John Knox", org: "ccel.org", link: "https://www.ccel.org" },
    ],
  },
  {
    id: "classic",
    icon: "📚",
    title: "Classic Commentators",
    subtitle: "Honour Only",
    scholars: [
      { name: "Matthew Henry", org: "Public domain" },
      { name: "Albert Barnes", org: "Public domain" },
      { name: "John Calvin", org: "Public domain" },
      { name: "John Wesley", org: "Public domain" },
      { name: "Charles Spurgeon", org: "Public domain — support link above" },
    ],
  },
];

function ScholarRow({ scholar }: { scholar: Scholar }) {
  const hasLink = !!scholar.link;
  const isHonourOnly = scholar.org === "Honour Only";

  return (
    <li className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-foreground">{scholar.name}</span>
        <span className="text-xs text-muted-foreground">
          {isHonourOnly ? "Honour Only" : scholar.org}
        </span>
      </div>
      {hasLink && (
        <a
          href={scholar.link}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1.5 self-start rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:mt-0 sm:self-auto"
        >
          <Heart className="h-3 w-3" />
          Support
        </a>
      )}
    </li>
  );
}

function ScholarGroupSection({ group }: { group: ScholarGroup }) {
  return (
    <AccordionItem value={group.id} className="border border-border rounded-xl px-4 sm:px-5 data-[state=open]:bg-accent/20">
      <AccordionTrigger className="text-sm font-semibold text-foreground hover:no-underline py-3">
        <span className="flex items-center gap-2">
          <span className="text-base">{group.icon}</span>
          {group.title}
        </span>
      </AccordionTrigger>
      <AccordionContent className="pb-3">
        {group.subtitle && (
          <p className="mb-2 text-xs italic text-muted-foreground">{group.subtitle}</p>
        )}
        <ul className="divide-y divide-border">
          {group.scholars.map((s) => (
            <ScholarRow key={s.name} scholar={s} />
          ))}
        </ul>
      </AccordionContent>
    </AccordionItem>
  );
}

export function ScholarSupport() {
  return (
    <section className="mt-16 rounded-2xl border border-border bg-card p-6 sm:p-8">
      <Accordion type="single" collapsible defaultValue="support">
        <AccordionItem value="support" className="border-0">
          <AccordionTrigger className="text-base font-semibold text-foreground hover:no-underline py-2">
            <span className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-primary" />
              Support the Scholars Who Make VerseSmart Possible
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-0 pt-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              VerseSmart exists because generations of theologians, pastors, scholars, and global Christian voices have poured their lives into studying Scripture. Their work makes this app possible. If VerseSmart has helped you, please consider supporting the ministries and scholars whose insights we draw from. All donations go directly to them — not to us.
            </p>

            <Accordion type="single" collapsible className="mt-6 space-y-3">
              {GROUPS.map((g) => (
                <ScholarGroupSection key={g.id} group={g} />
              ))}
            </Accordion>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}
