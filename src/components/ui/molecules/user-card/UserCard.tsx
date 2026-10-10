import { NO_PROFILE_IMAGE } from "@/lib/constant";
import { getIcon } from "@/lib/utils";
import { useTranslate } from "@tolgee/react";

const UserCard = ({ userInfo }: any) => {
  const { t } = useTranslate();
  return (
    <div className="space-y-6 px-6 py-2">
      <div className="flex flex-col md:flex-row items-start gap-6">
        <div className="w-24 h-24 rounded-full overflow-hidden flex-shrink-0 border-2 border-dashed border-gray-200 dark:border-[#505050]">
          <img
            src={
              userInfo.image?.medium || userInfo.image_url || NO_PROFILE_IMAGE
            }
            alt={t("studio.shell.profile_image_alt")}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1">
          <h2 className=" font-semibold">
            {userInfo.firstname} {userInfo.lastname}
          </h2>
          <p className="text-sm text-muted-foreground">{userInfo.email}</p>
          {userInfo.bio && (
            <p className="text-gray-700 mt-2 text-sm dark:text-white">
              {userInfo.bio}
            </p>
          )}
          {userInfo.social_profiles?.length > 0 && (
            <div className="flex mt-2 items-center gap-2 flex-wrap">
              {userInfo.social_profiles.map((social: any, i: number) => {
                const Icon = getIcon(social.account);
                const href =
                  social.account === "email"
                    ? `mailto:${social.url}`
                    : social.url;
                const target =
                  social.account === "email" ? undefined : "_blank";
                return (
                  <a
                    key={i}
                    href={href}
                    target={target}
                    rel={
                      social.account === "email"
                        ? undefined
                        : "noopener noreferrer"
                    }
                    className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-input/30 rounded-md hover:bg-gray-100 dark:hover:bg-input transition-colors group"
                  >
                    <Icon />
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserCard;
