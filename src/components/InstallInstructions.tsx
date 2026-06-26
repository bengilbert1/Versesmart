import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Share, MoreVertical, Download } from "lucide-react";
import { useLanguage } from "@/lib/language-context";

export function InstallInstructionsLink() {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="hover:text-foreground">{t("installApp.open")}</button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" /> {t("installApp.title")}
          </DialogTitle>
          <DialogDescription>{t("installApp.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2 text-sm">
          <section>
            <h3 className="font-semibold text-foreground">{t("installApp.iphoneTitle")}</h3>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-muted-foreground">
              <li>{t("installApp.ip1_pre")} <span className="font-medium text-foreground">www.versesmart.org</span> {t("installApp.ip1_post")}</li>
              <li>{t("installApp.ip2_pre")} <Share className="inline h-4 w-4 align-[-3px]" /> <span className="font-medium text-foreground">{t("installApp.ip2_share")}</span> {t("installApp.ip2_post")}</li>
              <li>{t("installApp.ip3_pre")} <span className="font-medium text-foreground">{t("installApp.ip3_add")}</span>{t("installApp.ip3_post")}</li>
              <li>{t("installApp.ip4_pre")} <span className="font-medium text-foreground">{t("installApp.ip4_add")}</span> {t("installApp.ip4_post")}</li>
            </ol>
          </section>

          <section>
            <h3 className="font-semibold text-foreground">{t("installApp.androidTitle")}</h3>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-muted-foreground">
              <li>{t("installApp.an1_pre")} <span className="font-medium text-foreground">www.versesmart.org</span> {t("installApp.an1_post")}</li>
              <li>{t("installApp.an2_pre")} <MoreVertical className="inline h-4 w-4 align-[-3px]" /> {t("installApp.an2_post")}</li>
              <li>{t("installApp.an3_pre")} <span className="font-medium text-foreground">{t("installApp.an3_install")}</span> {t("installApp.an3_or")} <span className="font-medium text-foreground">{t("installApp.an3_add")}</span>{t("installApp.an3_post")}</li>
              <li>{t("installApp.an4_pre")} <span className="font-medium text-foreground">{t("installApp.an4_install")}</span>{t("installApp.an4_post")}</li>
            </ol>
          </section>

          <section>
            <h3 className="font-semibold text-foreground">{t("installApp.desktopTitle")}</h3>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-muted-foreground">
              <li>{t("installApp.ds1_pre")} <Download className="inline h-4 w-4 align-[-3px]" /> {t("installApp.ds1_post")}</li>
              <li>{t("installApp.ds2_pre")} <span className="font-medium text-foreground">{t("installApp.ds2_install")}</span>{t("installApp.ds2_post")}</li>
            </ol>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
