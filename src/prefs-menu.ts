import {
	CUSTOM_FIELD_DATA_PREF,
	FORBIDDEN_PREF_STRING_CHARACTERS,
	prefStringToList,
	listToPrefString,
	CustomFieldData,
	CustomFieldPosition,
} from "./modules/overlay";
import { getPref, setPref } from "./utils/prefs";
import { getString } from "./utils/locale";

const CUSTOM_FIELDS_TABLE_BODY = "custom-fields-table-body";
const CUSTOM_FIELDS_TABLE_HIDDEN_ROW = "custom-fields-table-hidden-row";

function onPrefsLoad(window: Window) {
	setTableCustomFields(window);
}

function resetPrefsMenu(window: Window) {}

function setTableCustomFields(window: Window) {
	const tableBodyStatusNames = window.document.getElementById(
		CUSTOM_FIELDS_TABLE_BODY,
	);
	for (const row of createTableRowsCustomFields(window)) {
		tableBodyStatusNames?.append(row);
	}
}

function addTableRowCustomFields(window: Window) {
	window.document
		.getElementById(CUSTOM_FIELDS_TABLE_BODY)
		?.append(createTableRowStatusNames(window, "", ""));
}

function resetTableCustomFields(window: Window) {
	const tableRows = window.document.getElementById(
		CUSTOM_FIELDS_TABLE_BODY,
	)?.children;
	// leave the hidden row there so we can still clone it
	(Array.from(tableRows ?? []) as HTMLTableRowElement[])
		.filter((row) => !row.hidden)
		.map((row) => {
			row.remove();
		});
	setPref(CUSTOM_FIELD_DATA_PREF, "");
	setTableCustomFields(window);
}

function getTableCustomFieldRows(window: Window) {
	const tableRows = window.document.getElementById(
		CUSTOM_FIELDS_TABLE_BODY,
	)?.children;
	const names: string[] = [];
	const positions: string[] = [];
	for (const row of tableRows ?? []) {
		if (!(row as HTMLTableRowElement).hidden) {
			names.push((row.children[0].firstChild as HTMLInputElement).value);
			positions.push(
				(row.children[1].firstChild as HTMLInputElement).value,
			);
		}
	}
	return { names, positions };
}

function inputContainsForbiddenCharacters(input: HTMLInputElement) {
	// the pref string is delimited with ; and | characters, so these can't be used in custom status names or icons
	const valueCharacters = new Set(input.value);
	return (
		[...FORBIDDEN_PREF_STRING_CHARACTERS].filter((char) =>
			valueCharacters.has(char),
		).length > 0
	);
}

function setDuplicateTableRowsAsInvalid(
	window: Window,
	duplicates: Set<string>,
) {
	const tableRows = window.document.getElementById(
		CUSTOM_FIELDS_TABLE_BODY,
	)?.children;
	for (const row of tableRows ?? []) {
		const nameInput = row.children[0].firstChild as HTMLInputElement;
		if (duplicates.has(nameInput.value)) {
			nameInput.setCustomValidity("duplicate");
		}
	}
}

function checkAllTableRowsAreValid(window: Window) {
	const tableRows = window.document.getElementById(
		CUSTOM_FIELDS_TABLE_BODY,
	)?.children;
	for (const row of tableRows ?? []) {
		const nameInput = row.children[0].firstChild as HTMLInputElement;
		nameInput.setCustomValidity(
			inputContainsForbiddenCharacters(nameInput)
				? "invalid-characters"
				: "",
		);
	}
}

function validateTableRows(window: Window) {
	checkAllTableRowsAreValid(window);
	// now check for duplicate names
	const { names } = getTableCustomFieldRows(window);
	const unique = new Set(names);
	if (unique.size != names.length) {
		const duplicates = new Set(
			names.filter((item) => {
				if (unique.has(item)) {
					unique.delete(item);
				} else {
					return item;
				}
			}),
		);
		setDuplicateTableRowsAsInvalid(window, duplicates);
	}
}

function tableContainsInvalidInput(window: Window) {
	const tableRows = window.document.getElementById(
		CUSTOM_FIELDS_TABLE_BODY,
	)?.children;
	for (const row of tableRows ?? []) {
		if (!(row as HTMLTableRowElement).hidden) {
			const nameInput = row.children[0].firstChild as HTMLInputElement;
			if (inputContainsForbiddenCharacters(nameInput)) {
				return true;
			}
		}
	}
	return false;
}

function saveTableCustomFields(window: Window) {
	const { names, positions } = getTableCustomFieldRows(window);
	if (new Set(names).size != names.length) {
		Services.prompt.alert(
			window as mozIDOMWindowProxy,
			getString("duplicate-custom-field-title"),
			getString("duplicate-custom-field-description"),
		);
		return;
	} else if (tableContainsInvalidInput(window)) {
		Services.prompt.alert(
			window as mozIDOMWindowProxy,
			getString("invalid-custom-field-title"),
			getString("invalid-custom-field-description"),
		);
		return;
	}
	const customFieldData: CustomFieldData[] = names.map((name, index) => {
		return {
			name: name,
			position: positions[index] as CustomFieldPosition,
		};
	});
	setPref(CUSTOM_FIELD_DATA_PREF, listToPrefString(customFieldData));
	// if we change the statuses, need to reset the status lists here
	resetPrefsMenu(window);
}

function createTableRowsCustomFields(window: Window) {
	const customFieldData = prefStringToList(
		getPref(CUSTOM_FIELD_DATA_PREF) as string,
	);
	return customFieldData.map(({ name, position }) =>
		createTableRowStatusNames(window, name, position),
	);
}

function createTableRowStatusNames(
	window: Window,
	fieldName: string,
	position: CustomFieldPosition | "",
) {
	const row = window.document
		.getElementById(CUSTOM_FIELDS_TABLE_HIDDEN_ROW)
		?.cloneNode(true) as HTMLTableRowElement;
	row.id = "";
	row.hidden = false;

	const fromMenuList = row?.childNodes[0]?.firstChild as HTMLInputElement;
	const positionMenuList = row?.childNodes[1]
		?.firstChild as XULMenuListElement;
	const deleteButton = row?.childNodes[2]?.firstChild as HTMLButtonElement;

	fromMenuList.value = fieldName;
	fromMenuList.oninput = () => validateTableRows(window);
	positionMenuList.selectedIndex =
		position != ""
			? (positionMenuList.selectedIndex = [
					"start",
					"end",
					"afterCreators",
				].indexOf(position))
			: 0;

	if (row && deleteButton) {
		deleteButton.onclick = () => {
			row.remove();
		};
	}
	return row;
}

export default {
	onPrefsLoad,
	addTableRowCustomFields,
	resetTableCustomFields,
	saveTableCustomFields,
};
