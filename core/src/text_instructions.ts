import { ResourceEdge } from "./resource_edge";
import { inventory_label_suffix } from "./strings";
import { get_node_columns } from "./node_columns";
import { get_recipe } from "./recipe_info";

declare var recipe_type_functions: any;
declare var stack_sizes: any;

const text_instructions_elem = document.getElementById("text_instructions")!;

export const generate_instructions = (edges: { [key: string]: ResourceEdge }, generation_totals: { [key: string]: number }) => {
	// Delete any old instructions
	while (text_instructions_elem.firstChild) {
		text_instructions_elem.removeChild(text_instructions_elem.firstChild);
	}

	// Exit early if there is nothing to generate
	if (Object.keys(generation_totals).length === 0) {
		return;
	}

	var node_columns = get_node_columns(edges);

	var instructions: HTMLElement = document.createElement("div");
	var column_count = 0;

	var inventory_resources: HTMLDivElement[] = [];
	var needed_resources: HTMLDivElement[] = [];
	// List out raw resource numbers
	for (let node in node_columns) {
		if (node_columns[node] === 0) {
			var line_wrapper = document.createElement("div");
			line_wrapper.classList.add("instruction_wrapper");
			let is_inventory = node.endsWith(inventory_label_suffix);
			var base_ingredients = text_item_object(generation_totals[node], node.replace(inventory_label_suffix, ""));
			line_wrapper.appendChild(base_ingredients);

			if (is_inventory) {
				inventory_resources.push(line_wrapper);
			}
			else {
				needed_resources.push(line_wrapper);
			}
		}

		// Track the largest column as the max column count
		if (node_columns[node] >= column_count) {
			column_count = node_columns[node] + 1;
		}
	}

	let base_ingredients_title_elem = document.createElement("div");
	base_ingredients_title_elem.id = "text_instructions_title"; // TODO: this should be a class now that it effects multiple elements
	base_ingredients_title_elem.textContent = (inventory_resources.length > 0 ? "Missing " : "") + "Base Ingredients";
	instructions.appendChild(base_ingredients_title_elem);
	for (let needed_resource in needed_resources) {
		instructions.appendChild(needed_resources[needed_resource]);
	}


	if (inventory_resources.length > 0) {
		let inventory_resources_title = document.createElement("div");
		inventory_resources_title.setAttribute("id", "text_instructions_title");
		inventory_resources_title.textContent = "Already Owned Base Ingredients";
		instructions.appendChild(inventory_resources_title);

		for (let inventory_resource in inventory_resources) {
			instructions.appendChild(inventory_resources[inventory_resource]);
		}
	}

	// Text Instructions for crafting
	let text_instructions_title = document.createElement("div");
	text_instructions_title.id = "text_instructions_title"; // TODO: this should be a class now that it effects multiple elements
	text_instructions_title.textContent = "Text Instructions [Beta]";
	instructions.appendChild(text_instructions_title);

	// Create the step by step instructions
	for (let i = 1; i < column_count; i++) {
		for (let node in node_columns) {
			if (node_columns[node] === i) {

				if (node.startsWith("[Final]") || node.startsWith("[Extra]")) {
					continue;
				}

				instructions.appendChild(build_instruction_line(edges, node, generation_totals));
				let instruction_inventory_line = wrap_instruction(build_instruction_inventory_line(edges, node));
				if (instruction_inventory_line !== null) {
					instructions.appendChild(instruction_inventory_line)
				}
			}
		}

		var line_break = document.createElement("div");
		line_break.classList.add("instruction_line_break");
		instructions.appendChild(line_break);
	}

	// Add the new instruction list to the page
	text_instructions_elem.appendChild(instructions);
}

const build_instruction_line = (
	edges: { [key: string]: ResourceEdge },
	item_name: string,
	generation_totals: { [key: string]: number }
): HTMLDivElement => {
	if (!generation_totals[item_name]) {
		return document.createElement("div");
	}

	// Build the input item sub string
	var inputs: { [key: string]: number } = {};
	for (let edge in edges) {
		// If this is pointing into the resource we are currently trying to craft
		if (edges[edge].target === item_name && !(edges[edge].source.endsWith(inventory_label_suffix))) {
			inputs[edges[edge].source] = edges[edge].value;
		}
	}

	var recipe_type = get_recipe(item_name).recipe_type;

	if (recipe_type_functions[recipe_type] === undefined) {
		return document.createElement("div");
	}

	return recipe_type_functions[recipe_type](inputs, item_name, generation_totals[item_name], text_item_object);
}

const build_instruction_inventory_line = (
	edges: { [key: string]: ResourceEdge },
	item_name: string
): HTMLElement | null => {
	let amount_to_take: number = 0;
	for (let edge in edges) {
		// If this is pointing into the resource we are currently trying to take from the inventory.
		if (edges[edge].target === item_name && (edges[edge].source.endsWith(inventory_label_suffix))) {
			amount_to_take = edges[edge].value;
			break;
		}
	}

	if (!amount_to_take) {
		return null;
	}

	const span = document.createElement("span");

	span.appendChild(document.createTextNode("Take "));
	span.appendChild(text_item_object(amount_to_take, item_name));
	span.appendChild(document.createTextNode(" from inventory."));

	return span;
}

const wrap_instruction = (to_be_wrapped: HTMLElement | null): HTMLElement => {
	const line_wrapper = document.createElement("div");

	if (to_be_wrapped == null) {
		return line_wrapper;
	}

	line_wrapper.classList.add("instruction_wrapper");

	const checkbox = document.createElement("input");
	checkbox.type = "checkbox";
	const label = document.createElement("label");
	label.classList.add("strikethrough");

	line_wrapper.appendChild(checkbox);
	label.appendChild(to_be_wrapped);
	line_wrapper.appendChild(label);

	return line_wrapper;
}

const text_item_object = (count: number, name: string): HTMLSpanElement => {
	const item_object = document.createElement("span");

	if (!count) {
		return item_object;
	}

	item_object.classList.add("instruction_item");
	item_object.appendChild(document.createTextNode(count.toString()));

	const units = (<HTMLInputElement>document.querySelector("input[name=unit_name]:checked")).value;

	if (units !== "" && units !== undefined) {
		const unit_value_list = build_unit_value_list(count, units, name);

		let join_plus_character = "";
		let smalltext = "";
		for (let i = 0; i < unit_value_list.length; i++) {
			smalltext += join_plus_character + unit_value_list[i].count;

			if (unit_value_list[i].name !== "") {
				smalltext += " " + unit_value_list[i].name;
			}
			join_plus_character = " + ";
		}

		// If there is more than one unit, or only one that is not default
		if (unit_value_list.length > 1 || unit_value_list[0].name !== "") {
			const small_unit_elem = document.createElement("span");
			small_unit_elem.classList.add("small_unit_name");
			small_unit_elem.textContent = " (" + smalltext + ")";
			item_object.appendChild(small_unit_elem);
		}
	}

	item_object.appendChild(document.createTextNode(" " + name));

	return item_object;
}


class ValueListElem {
	name: string = "";
	count: number;

	constructor(count: number) {
		this.count = count
	}
}

const build_unit_value_list = (number: number, unit_name: string, item_name: string): ValueListElem[] => {
	if (number === 0) {
		return [];
	}
	if (unit_name === null) {
		return [new ValueListElem(number)];
	}

	const unit = stack_sizes[unit_name];
	const unit_size = get_unit_size(unit_name, item_name);
	const quotient = Math.floor(number / unit_size);
	const remainder = number % unit_size;

	let value_list: ValueListElem[] = [];

	if (quotient > 0) {
		const value_list_element = new ValueListElem(quotient);
		if (quotient > 1) {
			value_list_element.name = unit.plural;
		}
		else {
			value_list_element.name = unit_name;
		}
		value_list = [value_list_element];
	}

	// recurse down all the other possible units until
	value_list = value_list.concat(build_unit_value_list(remainder, unit.extends_from, item_name));

	return value_list;
}

////////////////////////////////////////////////////////////////////////////////
// Gets the base number of items that would fit in a particular unit accounting
// for the units that it is based off of.
////////////////////////////////////////////////////////////////////////////////
const get_unit_size = (unit_name: string, item_name: string): number => {
	let multiplier = stack_sizes[unit_name].quantity_multiplier;

	// Check for unique sizes for this particular item
	if ("custom_multipliers" in stack_sizes[unit_name] && item_name in stack_sizes[unit_name].custom_multipliers) {
		multiplier = stack_sizes[unit_name].custom_multipliers[item_name];
	}

	// Chain sizes from extended size
	if (stack_sizes[unit_name].extends_from !== null) {
		multiplier = multiplier * get_unit_size(stack_sizes[unit_name].extends_from, item_name);
	}

	return multiplier;
}
