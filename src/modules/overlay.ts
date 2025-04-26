import { config } from "../../package.json";
import { getString } from "../utils/locale";
import {
	getPref,
	initialiseDefaultPref,
	getPrefGlobalName,
} from "../utils/prefs";
import {
	getItemExtraProperty,
	setItemExtraProperty,
} from "../utils/extraField";

export const CUSTOM_FIELD_DATA_PREF = "custom-field-data";
export const FORBIDDEN_PREF_STRING_CHARACTERS = new Set(":;|");

export type CustomFieldPosition = "start" | "afterCreators" | "end";
export type CustomFieldData = {
	name: string;
	position: CustomFieldPosition;
};

function getItemCustomField(item: Zotero.Item, fieldName: string) {
	const statusField = getItemExtraProperty(item, fieldName);
	return statusField.length == 1 ? statusField[0] : "";
}

function setItemCustomField(
	item: Zotero.Item,
	fieldName: string,
	fieldValue: string,
) {
	setItemExtraProperty(item, fieldName, fieldValue);
	void item.saveTx();
}

// pref string looks like "name1;position1|name2;position2|...""
export function prefStringToList(prefString: string): CustomFieldData[] {
	if (prefString == "") {
		return [];
	}
	return prefString.split("|").map((nameAndPosition) => {
		return {
			name: nameAndPosition.split(";")[0],
			position: nameAndPosition.split(";")[1] as CustomFieldPosition,
		};
	});
}

export function listToPrefString(nameAndPositionList: CustomFieldData[]) {
	return nameAndPositionList
		.map(
			(nameAndPosition) =>
				`${nameAndPosition.name};${nameAndPosition.position}`,
		)
		.join("|");
}
//
export default class ZoteroCustomItemFields {
	customFieldData: CustomFieldData[];
	preferenceUpdateObservers?: symbol[];
	rowIDs?: string[];

	constructor() {
		this.initialiseDefaultPreferences();

		this.customFieldData = prefStringToList(
			getPref(CUSTOM_FIELD_DATA_PREF)! as string,
		);

		this.addPreferencesMenu();
		this.addPreferenceUpdateObservers();
		this.addCustomItemFields();

		// resgister the locale file so it'll correctly apply to custom item rows
		// see https://groups.google.com/g/zotero-dev/c/wirqnj_EQUQ/m/ud3k0SpMAAAJ
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
		window.MozXULElement.insertFTLIfNeeded(`${config.addonRef}-addon.ftl`);
	}

	public unload() {
		this.removePreferenceMenu();
		this.removePreferenceUpdateObservers();
		this.removeCustomItemFields();
	}

	addCustomItemFields() {
		this.rowIDs = this.customFieldData.map((customField) =>
			this.registerInfoRow(customField.name, customField.position),
		);
	}

	removeCustomItemFields() {
		if (this.rowIDs) {
			this.rowIDs.forEach((rowID) =>
				Zotero.ItemPaneManager.unregisterInfoRow(rowID),
			);
		}
	}

	registerInfoRow(infoRowName: string, position: CustomFieldPosition) {
		return Zotero.ItemPaneManager.registerInfoRow({
			rowID: `zotero-custom-item-fields-${infoRowName}-${position}`,
			pluginID: config.addonID,
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			label: {
				// undocumented hack that we can pass specific text here and disable the localisation
				l10nID: "",
				text: infoRowName,
			} as any,
			position: position,
			multiline: false,
			nowrap: false,
			editable: true,
			onGetData({ item }) {
				return getItemCustomField(item, infoRowName);
			},
			onSetData({ item, value }) {
				setItemCustomField(item, infoRowName, value);
			},
		}) as string;
	}

	initialiseDefaultPreferences() {
		initialiseDefaultPref(CUSTOM_FIELD_DATA_PREF, "");
	}

	addPreferenceUpdateObservers() {
		this.preferenceUpdateObservers = [
			Zotero.Prefs.registerObserver(
				getPrefGlobalName(CUSTOM_FIELD_DATA_PREF),
				(value: string) => {
					this.customFieldData = prefStringToList(value);
					this.removeCustomItemFields();
					this.addCustomItemFields();
				},
				true,
			),
		];
	}

	removePreferenceUpdateObservers() {
		if (this.preferenceUpdateObservers) {
			for (const preferenceUpdateObserverSymbol of this
				.preferenceUpdateObservers) {
				Zotero.Prefs.unregisterObserver(preferenceUpdateObserverSymbol);
			}
			this.preferenceUpdateObservers = undefined;
		}
	}

	addPreferencesMenu() {
		const prefOptions = {
			pluginID: config.addonID,
			src: rootURI + "chrome/content/preferences.xhtml",
			label: getString("prefs-title"),
			image: `chrome://${config.addonRef}/content/icons/favicon.png`,
			defaultXUL: true,
		};
		void Zotero.PreferencePanes.register(prefOptions);
	}

	removePreferenceMenu() {
		Zotero.PreferencePanes.unregister(config.addonID);
	}
}
