/*
The MIT License (MIT)

Copyright (c) 2013-2014 Rosario Alfano

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/

/*
- i_container: a JQuery <DIV> element containing the pivot table

- i_configuration: configuration parameters in the following format:

- i_on_change_query: the function that must be called every time the layout of the pivot change in order to get the new data with the following parameters:
	* q_dimensions_rows: an array containing the dimensions to show in the layout
	* q_dimensions_cols: an array containing the dimensions to show in the layout
	* q_measures: an array containing the measure to show in the layout
	* q_filters: an array of object in the format {dimension: value} in order to filter the dataset,
	* q_on_data_ready: a function that manage the response with the data corresponding to the given filters

- i_get_dim_attribute_elements: the function that must be called every time a dimension attribute elements list is needed:

	* dimension.attribute: the dimension attribute the list must be returned (<dimension_name>.<attribute_name>)

- i_apply_measure_action: apply a planning action to the given measure identified by:
	* action: the action to apply (propotionalInc|weightedInc|equalInc)
	* select_string: the combination of attribute at the row and column selected
	* filters: the filter currenty applied
	* measure: the name of the measure to which apply the action
	* current_value: the current value of the measure	
	
*/
function PlannificoPivot (i_container, i_configuration, i_on_change_query, i_get_dim_attribute_elements, i_apply_measure_action, i_menu_item) {

	this.container = i_container;
	this.configuration = i_configuration;

	this.isQueryChanged = true;
	
	this.currentDimensionsCols = [];
	this.currentDimensionsRows = [];
	this.currentMeasures = [];
	this.currentFilters = [];
	this.menuItems = i_menu_item;


	if (i_on_change_query && (typeof i_on_change_query == "function")) {
		
		this.onChangeQuery = i_on_change_query;		
		
	} else 
		this.onChangeQuery = function (dr,dc,m,f,data) {console.log ("this.onChangeQuery not set");};
	
	if (i_get_dim_attribute_elements && (typeof i_get_dim_attribute_elements == "function")) {
		
		this.getDimAttributeElements = i_get_dim_attribute_elements;		
		
	} else 
		this.getDimAttributeElements = function (d,a) {console.log ("this.getDimAttributeElements not set"); return []};

	if (i_apply_measure_action && (typeof i_apply_measure_action == "function")) {
		
		this.applyMeasureAction = i_apply_measure_action;		
		
	} else 
		this.applyMeasureAction = function () {console.log ("this.applyMeasureAction not set");};

}

/*
	Completely refresh the pivot container
*/
PlannificoPivot.prototype.refresh = function () {

	this.isQueryChanged = true;
	
	this.currentDimensionsCols = [];
	this.currentDimensionsRows = [];
	this.currentMeasures = [];
	this.currentFilters = [];
	
	if (this.container.children().length > 0) {
	
		this.container.remove ("div");
	}

	this.leftContainer = $ ("<div>", {
		
		"id": 'left-container',
		"class": 'span-3'
			
	}).appendTo (this.container);

	this.rightContainer = $ ("<div>", {
		
		"id": 'right-container',
		"class": 'span-20'
			
	}).appendTo (this.container);
		
	this.addDraggableDimensions (this.configuration.dimensionsLabel, this.configuration.dimensions, "dim-", "draggable-dim");

	this.addDraggableMeasures (this.configuration.measuresLabel, this.configuration.measures, "measure-", "draggable-measure");

	this.addPivotArea ();
	
	//Apply the droppable behaviour to the dimension.attributes
	this.applyDroppable ();

	var self = this;

	$('#right-container').accordion ({
		heightStyle: "content",
		beforeActivate: function( event, ui ) {

			console.log ("ui.newHeader.id " + ui.newHeader.attr("id") );

			if (ui.newHeader.attr("id") == "pivot-data-header")
				self.refreshDataAreaArea ();
		}		
	});
}

/*Private methods*/

/*
	Refresh the data area with the grid of data
*/
PlannificoPivot.prototype.refreshDataAreaArea = function () {

	console.log ("refreshDataAreaArea");

	var data_area = $("#pivot-data-area");

	if (data_area.children().length > 0) {
	
		data_area.empty ();
	}	

	var filter_container = $ ("<div>", {
		
		"id": 'filter-container'
			
	}).appendTo (data_area);

	$("<ul>").appendTo (filter_container).append ($("<li>")).append ("<a>", {"href": "#tabs-1"}).html ("filters");

	$("<div>", {"id": "tabs-1", "class":"small"}).appendTo (filter_container).html (this.filtersToString());

	$( "#filter-container" ).tabs();
	

	console.log ("this.isQueryChanged " + this.isQueryChanged);

	var table_container = $ ("<div>", {
		
		"id": 'data-grid-container'/*,
		"class": 'small span-15'*/
			
	}).appendTo (data_area);

	var self = this;

	if (this.isQueryChanged) {

		$("data-grid-container").addClass ("currently-loading-pivot");

		this.onChangeQuery (
			this.currentDimensionsRows,
			this.currentDimensionsCols,
			this.currentMeasures,
			this.currentFilters,
			function (data) {

				console.log ("onDataReady()");		

				$("data-grid-container").removeClass ("currently-loading-pivot");
	
				self.createPivotTable (table_container, data);
			}				
		);
	}
	
}

PlannificoPivot.prototype.filtersToString = function () {

	var filters_label = "";

	$.each (this.currentFilters, function (idx, filter) {

		filters_label += filter.dimension + "." + filter.attribute + " " + filter.comparison + " " +  filter.filterValue + " AND ";
	});

	filters_label = filters_label.substring(0, filters_label.length - 5);

	return filters_label;
}

PlannificoPivot.prototype.createPivotTable = function (table_container, data) {

	var self = this;
				
	var pivot_table = $ ("<table>", {

		"id": 'pivot-table'

	}).appendTo (table_container);

	var cols_attributes = [];
	var rows_attributes = [];
	
	var value_to_attribute = {};

	var cross_values = {};
	
	this.populatePivotDataStructure (data, cols_attributes, rows_attributes, value_to_attribute, cross_values);
	
	var col_headers = [];

	var header_html = $("<thead>").appendTo (pivot_table);

	//Create an header for each attribute in column:
	$.each (self.currentDimensionsCols, function (idx, col_field) {

		var col_h = $ ("<tr>", {

			"id": 'col-header-' + self.field2id (col_field),
			"attribute": col_field

		}).appendTo (header_html);					

		col_headers.push (col_h);
	});
	
	//Create the basic header where attributes in row are shown:
	var html_table_header = $ ("<tr>", {

		"id": 'row-header'

	}).appendTo (header_html);

	//Put in the basic header the attribute in row:
	$.each (self.currentDimensionsRows, function (idx_row, row_field) {

		$.each (col_headers, function (idx, header) {

			var label = " ";

			if (idx_row == self.currentDimensionsRows.length - 1) {
				label = $(header).attr("attribute").toLowerCase().replace (".", " [").concat ("]");
			
			}
			$ ("<th>", {

				"id": 'col-header-' + row_field + "-" + idx,
				"class": "p-pivot-header"

			}).appendTo (header).html (label.toLowerCase());
		});

		$ ("<th>", {

			"id": 'header-' + row_field,
			"class": "p-pivot-header"

		}).appendTo (html_table_header).html (row_field.toLowerCase().replace (".", " [").concat ("]"));
	});
	
	//Add the attribute in row:
	$.each (rows_attributes, function (index, row) {

		var html_row = $ ("<tr>", {

			"id": 'pt_row_' + self.field2id (row)

		}).appendTo (pivot_table);
		
		var fields = row.split (";");
		
		console.log ("fields: " + fields);
		
		$.each (fields, function (idx_field, field) {
		
			if (field == "") return; 
		
			var th = $ ("<td>", {

				"id": 'td-field-' + idx_field,
				"class": "p-pivot-row-header"

			}).appendTo (html_row).html (field);
		});
	});
	
	//Add the attribute in columns:
	$.each (cols_attributes, function (index, col) {
	
		console.log ("col fields " + col);
	
		var fields = col.split (";");
		
		$.each (self.currentMeasures, function (idx_m, measure) {
		
			$.each (fields, function (idx_field, field) {
			
				if (field == "") return; 
			
				//get the header where to add the attribute:
				var field_col_header = $("#col-header-" + self.field2id (value_to_attribute [field]));
		
				console.log ("value_to_attribute [field] " + value_to_attribute [field] + " " + field_col_header.attr("id"));
				
				var th = $ ("<th>", {

					"id": 'th-field-' + self.field2id (value_to_attribute [field]) + "_" + idx_field,
					"class": "p-pivot-column-header"

				}).appendTo (field_col_header).html (field);
			
			});
			
			var th = $ ("<th>", {

				"id": 'th-measure-' + measure + "_" + idx_m,
				"class": "p-pivot-column-header"

			}).appendTo ($("#row-header")).html (measure.toLowerCase());

			//Add the values:
			$.each (rows_attributes, function (index, row) {

				console.log ("cross_value: " + JSON.stringify(cross_values [row][col]));
				console.log ("measure: " + measure);	

				var value = "-";

				if (cross_values [row]) {
					
					if(cross_values [row][col]) {


						value = cross_values [row][col][measure];
					}								
				}
				
				var row_fields = row.split (";");
				var col_fields = col.split (";");

				var select_str = "";

				$.each(row_fields, function (idx_field, field) {
				
					select_str += value_to_attribute [field] + "=" + field + ";";
				});

				$.each(col_fields, function (idx_field, field) {
				
					select_str += value_to_attribute [field] + "=" + field + ";";
				});

				select_str = select_str.substring (0, select_str.length);

				var row_id_str = self.field2id (row);
				var col_id_str = self.field2id (col);

				var tr_row = $("#pt_row_" + row_id_str);
				
				var measure_container = $("<td>", {

					"id": 'td-measure-' + row_id_str + col_id_str,
					"selectString": select_str,
					"measure": measure,
					"currentValue": value,
					"class": "context-menu p-pivot-measure"

				}).appendTo (tr_row).html (value);

				

			});
		});
	});
	
	self.addContexMenu ();
}

/*Create the supporting structure needed to create the pivot:
an associative array for each measure that given the attributes 
in row and column returns the measure quantity:*/

PlannificoPivot.prototype.populatePivotDataStructure = function (data, cols_attributes, rows_attributes, value_to_attribute, cross_values) {

	var self = this;

	$.each (data, function (index, row) {		

		var measures_values = {};	

		var col_attributes_string = "";
		var row_attributes_string = "";

		console.log ("self.currentDimensionsCols " + self.currentDimensionsCols)
		console.log ("self.currentDimensionsRows " + self.currentDimensionsRows)

		var row_field_position = "";
		var col_field_position = "";

		$.each (self.currentDimensionsCols, function (idx, col_attribute){
		
			col_field_position += idx + ";";
		});

		$.each (self.currentDimensionsRows, function (idx, row_attribute){
		
			row_field_position += idx + ";";
		});
		
		$.each (row, function (field_idx, field) {
		
			if (field.measure) {						
			
				measures_values [field.measure] = field.value;							
			
			} else {

				//console.log ("field.attribute " + field.attribute);
				
				if (self.currentDimensionsRows.indexOf (field.attribute) != -1) {

					row_field_position = row_field_position.replace (self.currentDimensionsRows.indexOf (field.attribute)+"",field.value);
				
				} else if (self.currentDimensionsCols.indexOf (field.attribute) != -1) { 
				
					//col_attributes_string += field.value + ";";

					col_field_position = col_field_position.replace (self.currentDimensionsCols.indexOf (field.attribute)+"",field.value);
				}
				value_to_attribute [field.value] = field.attribute;
			}
		});

		//console.log ("row_field_position " + row_field_position);

		col_attributes_string = col_field_position.substring(0, col_field_position.length - 1);
		row_attributes_string = row_field_position.substring(0, row_field_position.length - 1);
		
		if (cols_attributes.indexOf (col_attributes_string) == -1) cols_attributes.push (col_attributes_string);
		if (rows_attributes.indexOf (row_attributes_string) == -1) rows_attributes.push (row_attributes_string);
		
		console.log ("row_attributes_string " + row_attributes_string);
		console.log ("col_attributes_string " + col_attributes_string);
		
		console.log ("measures_values " + measures_values);

		if (!cross_values [row_attributes_string]) cross_values [row_attributes_string] = {};

		cross_values [row_attributes_string][col_attributes_string] = measures_values;

		console.log ("cross_values [row_attributes_string + _ + col_attributes_string] " + 
			JSON.stringify (cross_values [row_attributes_string][col_attributes_string]));
						
	});

	//Sort the attributes in rows:
	rows_attributes = rows_attributes.sort (function (row_1,row_2) {
	
		if (row_1 > row_2) return 1;
		else if (row_1 < row_2) return -1;
		else return 0;
	});
	
	//Sort the attributes in columns:
	cols_attributes = cols_attributes.sort (function (row_1,row_2) {
	
		if (row_1 > row_2) return 1;
		else if (row_1 < row_2) return -1;
		else return 0;
	});
}


PlannificoPivot.prototype.addContexMenu = function () {

	var self = this;

	var menu_items = this.menuItems;

	$.contextMenu({
		selector: '.context-menu', 
		build: function($trigger, e) {
		    
			var select_str = $trigger.attr ("selectString");
			var measure = $trigger.attr ("measure");
			var current_value = $trigger.attr ("currentValue");
			var filters = self.filtersToString();
			
			return {
				callback: function(key, options) {

					var m = "clicked: " + key;
				
					console.log ("clicked: " + key);
				
					var dialogBox = $("<div>", {

						"id": 'dialog-form',
						"title": menu_items [key].name
		
					}).html("<form>" + 
							"<fieldset>" +
							"<label for='new_value_field'>New Value:</label>"+ 
							"<input type='number' size='5' name='new_value_field' id='new_value_field' value='" + 
								current_value + 
								"' class='number ui-widget-content ui-corner-all'>" + 
							"<input type='submit' tabindex='-1' style='position:absolute; top:-1000px'>" +
							"</fieldset>" +
						"</form>");		

					var apply = function() {

						var new_value = $("#new_value_field").val();
					
						console.log ("new value = " + new_value);

						$trigger.empty ();

						$trigger.addClass("currently-writing-cell");
					
						self.applyMeasureAction (
							key, 
							select_str, 
							filters, 
							measure,
							current_value, 
							new_value,
							function () {
								console.log ("applyMeasureAction [DONE]");

								$trigger.removeClass ("currently-writing-cell");
								$trigger.html(new_value);					
								
							}
						);
					
						dialogBox.dialog( "close" );
						dialogBox.empty();
						dialogBox.remove();
					};
						
					dialogBox.dialog({
						autoOpen: false,
						height: 220,
						width: 300,
						modal: true,
						buttons: {
							"Apply": apply, 
							Cancel: function() {
						
								dialogBox.dialog( "close" );
							}
						}
					});
					dialogBox.find( "form" ).on( "submit", function( event ) {

						event.preventDefault();
						apply();
					});
					dialogBox.dialog( "open" );
				
				},
			items: menu_items
			};
		}
    	});
}

/*
	Add the Pivot Area built by the selection area (where dimensions and measures are dropped) 
	and the data area where the result of the selection is diplayed
*/
PlannificoPivot.prototype.addPivotArea = function () {	

	var pivot_selection_header = $ ("<h3>", {

		"id": 'pivot-selection-header'/*,
		"class": 'span-20'*/
			
	}).appendTo (this.rightContainer).html (this.configuration.selectionHeaderLabel);

	var pivot_area = $ ("<div>", {
		
		"id": 'pivot-area'
			
	}).appendTo (this.rightContainer);
	
	var pivot_selection = $ ("<div>", {
		
		"id": 'pivot-selection',
		"class": 'span-18'
			
	}).appendTo (pivot_area);

	this.createPivotSelection (pivot_selection);

	this.createPivotDataArea ();
}	

/*
	Add the Pivot area where data are shown
*/
PlannificoPivot.prototype.createPivotDataArea = function (pivot_selection) {

	var pivot_selection_header = $ ("<h3>", {
		"id": 'pivot-data-header'/*,
		"class": 'span-20'*/
			
	}).appendTo (this.rightContainer).html (this.configuration.emptySelectionLabel.dataArea);
	
	var pivot_data = $ ("<div>", {
		
		"id": 'pivot-data-area',
		"class": 'span-18'
			
	}).appendTo (this.rightContainer);
}
	

/*
	Add the Pivot dimension.attribute selection area
*/
PlannificoPivot.prototype.createPivotSelection = function (pivot_selection) {	

	var pivot_selection_rows = $ ("<div>", {
		
		"id": 'pivot-selection-rows',
		"class": 'small span-5 border ui-widget-header droppable-dim'
			
	}).appendTo (pivot_selection).html (this.configuration.emptySelectionLabel.rows);
	
	var pivot_selection_cols = $ ("<div>", {
		
		"id": 'pivot-selection-cols',
		"class": 'small span-5 border ui-widget-header droppable-dim'
			
	}).appendTo (pivot_selection).html (this.configuration.emptySelectionLabel.cols);
	
	var pivot_selection_measures = $ ("<div>", {
		
		"id": 'pivot-selection-measures',
		"class": 'small span-5	 border ui-widget-header droppable-measure'
			
	}).appendTo (pivot_selection).html (this.configuration.emptySelectionLabel.measures);
	
	var pivot_selection_filters = $ ("<div>", {
		
		"id": 'pivot-selection-filters',
		"class": 'small span-15 border ui-widget-header droppable-filter'
			
	}).appendTo (pivot_selection).html (this.configuration.emptySelectionLabel.filters);

}

PlannificoPivot.prototype.addAttributeSelection = function (dims_container, id_prefix, additional_classes, dimensions, dimension) {

	var self = this;

	var dim_attribute_selection = $ ("<ul>", {
				
		"id":  id_prefix + dimension + '_attribute_sel'
		
	}).appendTo (dims_container);

	console.log ("dimension > " + dimension);
	
	console.log ("dimensions [dimension] " + dimensions [dimension]);
	
	//add the hidden dimension attributes
	if (dimensions [dimension].length > 0) {
		
		dimensions [dimension].map (function (attribute) {
			
			console.log ("adding attribute " + dimension + "." + attribute);
			
			var attribute_container = $ ("<li>", {
				
				"id":  "droppable-" + dimension + "-" + self.field2id (attribute),
				"pl-label": dimension + "." + attribute,
				"class": 'small span-1 ' + additional_classes,
				"parent-id": dim_attribute_selection.attr("id")
				
			}).appendTo (dim_attribute_selection).html (attribute.toLowerCase());
		});		
	}
	$( "#" + id_prefix + dimension + '_attribute_sel' ).menu();
}

PlannificoPivot.prototype.addDraggableDimensions = function (label, elements, id_prefix, additional_classes) {	
		
	var dims_container = $ ("<div>", {		
		
		"id":	'accordion-dim'
			
	}).appendTo (this.leftContainer);
	
	//Add an element for each dimension
	for (element in elements) {
	
		$ ("<h3>", {

			"id": id_prefix + this.field2id (element),
			"class": 'span-2 border ui-widget-content' 
			
		}).appendTo (dims_container)
			.html (element.toLowerCase());
	
	
		this.addAttributeSelection (dims_container, id_prefix, additional_classes, elements, element);

	}		
	$( "#accordion-dim" ).accordion(
	{
      		heightStyle: "content", active: "false", collapsible: "true"
    	});

	
}

PlannificoPivot.prototype.addDraggableMeasures = function (label, elements, id_prefix, additional_classes) {		

	var m_container = $ ("<div>", {		
		
		"id":	'accordion-measures'
			
	}).appendTo (this.leftContainer);

	var h3 = $ ("<h3>", {

		"class": 'span-2 border ui-widget-content' 
				
	}).appendTo (m_container).html (label);

	var measures = $ ("<ul>", {

		"id": 'measure-menu'
				
	}).appendTo (m_container);
	
	//Add an element for each dimension
	for (element in elements) {
	
		$ ("<li>", {

			"id": id_prefix + element,
			"pl-label": element,
			"class": 'small span-1 ' + additional_classes,
			"parent-id":'measure-menu',
			"measure-name": element
			
		}).appendTo (measures).html (element.toLowerCase());		
		
		$("#" + id_prefix + element).addClass (additional_classes);
		
	}		
	$( "#measure-menu" ).menu();

	$( "#accordion-measures" ).accordion(
	{
      		heightStyle: "content", active: "false", collapsible: "true"
    	});

}

/*
	Apply the droppable behavior to the componet
*/
PlannificoPivot.prototype.applyDroppable = function () {	

	var self = this;

	$(".draggable-dim").draggable({
		//revert: "invalid", 
		scope: ".pivot-selection-dim",
		cursor: 'move',
		revert: true, 
		helper: "clone"
	});
	
	$(".draggable-measure").draggable({
		revert: "true", 
		scope: ".pivot-selection-measure",
		cursor: 'move',		 
		helper: "clone"
	});

	this.applyDroppableDim ();
	this.applyDroppableMeasures ();
	this.applyDroppableFilters ();
}	

/*
	Remove the given element from the current layout structure
*/
PlannificoPivot.prototype.removeCurrentLayoutElement = function (element) {	
	
	var index = this.currentDimensionsRows.indexOf (element);
	
	if (index > -1) {

		this.currentDimensionsRows.splice(index, 1);
	
	} else {
	
		index = this.currentDimensionsCols.indexOf (element);
		
		if (index > -1) {

			this.currentDimensionsCols.splice(index, 1);
		} else {
		
			index = this.currentMeasures.indexOf (element);
			
			if (index > -1) {

				this.currentMeasures.splice(index, 1);
			}
		}
	}
}

/*
	Apply the droppable behavior to the dimensions selection box
*/
PlannificoPivot.prototype.applyDroppableDim = function () {	

	var self = this;

	$(".droppable-dim").droppable({
		
		scope: ".pivot-selection-dim",
		
		greedy: "true",

		
		drop: function( event, ui ) {
			
			console.log ("dropped " + $(ui.draggable).attr ("pl-label"));
			
			var dropped_dim_id = $(ui.draggable).attr ("id").replace ("droppable-","");
			
			var dropTarget = $(this);

			var dropped_dim = $('<div>', {"id": 'dropped-' + dropped_dim_id,"class": 'span-5'}).appendTo (dropTarget);
			
			var attribute = $(ui.draggable).attr ("pl-label");
			
			var dropped_dim_lb = $('<button>', {

				"id": 'delbtndim-' + dropped_dim_id, 
				"class": 'span-4'}
			).appendTo (dropped_dim).html(attribute.toLowerCase());
			
			$( "#delbtndim-" + dropped_dim_id )
			      .button()
			      .click (function( event ) {
		
				console.log("$(this).id " + $(this).attr ("id"));
				
				var dropped_id = $(this).attr ("id").replace ("delbtndim-","");						

				$("#dropped-" + dropped_id).remove();
		
				$("#" + $(this).attr("id") + "_attribute_sel").toggle();
				
				$("#droppable-" + dropped_id).show();

				console.log ("parent-id " + $("#droppable-" + dropped_id).attr ("parent-id"));

				self.removeCurrentLayoutElement (attribute);
				
				self.isQueryChanged = true;
			});
			
			$(ui.draggable).hide();
			
			console.log ("dropTarget.id " + $(dropTarget).attr ("id"));
			
			var target_id = $(dropTarget).attr ("id");
			
			if ((target_id == "pivot-selection-rows") || (target_id == "pivot-selection-cols")) {
				
				console.log ("dataNavigationInvoker.groupby " + $(ui.draggable).attr("id"));
				
				if (target_id == "pivot-selection-rows") self.currentDimensionsRows.push (attribute);
				if (target_id == "pivot-selection-cols") self.currentDimensionsCols.push (attribute);
				
				self.isQueryChanged = true;
				
				//dataNavigationInvoker.groupby.push ($(ui.draggable).text());					
			}
		}
	});

}

/*
	Apply the droppable behavior to the measures selection box
*/
PlannificoPivot.prototype.applyDroppableMeasures = function () {	

	var self = this;

	$(".droppable-measure").droppable({
		
		scope: ".pivot-selection-measure",
		
		greedy: "true",
		
		drop: function( event, ui ) {
			
			console.log ("dropped " + $(ui.draggable).attr ("id"));
			
			var dropTarget = $(this);
			
			var dropped_measure_id = $(ui.draggable).attr ("id");

			var dropped_m = $('<div>', {"id": 'dropped-' + dropped_measure_id,"class": 'span-5'}).appendTo (dropTarget);
			
			var dropped_m_lb = $('<button>', {

				"id": 'delbtn-measure-' + dropped_measure_id, 
				"class": 'span-5',
				"measure-name": $(ui.draggable).attr ("measure-name")
			}).appendTo (dropped_m).html ($(ui.draggable).attr ("pl-label").toLowerCase());

			console.log ("dropTarget.id " + $(dropTarget).attr ("id"));
			
			$( '#delbtn-measure-' + dropped_measure_id )
			      .button()
			      .click (function( event ) {
		
				console.log("$(this).id " + $(this).attr ("id"));
				
				var dropped_id = $(this).attr ("id").replace ("delbtn-measure-","");						

				$("#dropped-" + dropped_id).remove();
		
				$("#" + $(this).attr("id") + "_attribute_sel").toggle();
				
				console.log("dropped id " + dropped_id);

				$("#" + dropped_id).show();

				//console.log ("parent-id: " + $("#" + dropped_id).attr ("parent-id"));
				
				self.removeCurrentLayoutElement ($(ui.draggable).attr ("pl-label"));

				self.isQueryChanged = true;
			});

			$(ui.draggable).hide();			

			var target_id = $(dropTarget).attr ("id");
	
			if (target_id == "pivot-selection-measures") {
				
				console.log ("dataNavigationInvoker.measures " + $(ui.draggable).text());
				
				self.currentMeasures.push ($(ui.draggable).attr ("measure-name"));//TOMODIFY
				
				self.isQueryChanged = true;
			}
				
			
			//dropTarget.append ("<p>test</p>");
			
			//$( this ).addClass( "ui-state-highlight" ).find( "p" ).html( "Dropped!" );
		}
	});
}

/*
	Apply the droppable behavior to the dimensions selection box
*/
PlannificoPivot.prototype.applyDroppableFilters = function () {	
	
	var self = this;

	$(".droppable-filter").droppable({
		
		scope: ".pivot-selection-dim",
		
		greedy: "true",
		
		drop: function( event, ui ) {
			
			console.log ("dropped " + $(ui.draggable).attr ("pl-label"));
			
			var dropped_dim_id = $(ui.draggable).attr ("id").replace ("droppable-","");
			
			var dropTarget = $(this);

			var dropped_dim = $('<div>', {"id": 'dropped-' + dropped_dim_id,"class": 'span-20'}).appendTo (dropTarget);
			
			//Add the dimension and attribute to filter:
			var dropped_dim_lb = $('<button>', {

				"id": 'delbtn-filter-' + dropped_dim_id, 
				"class": 'span-5 border'
			}).appendTo (dropped_dim).html($(ui.draggable).attr ("pl-label").toLowerCase());
			
			//Add the selection for the comparison sign
			var comparison_sign = $('<select>', 
				{"id": 'comparison-selection-' + dropped_dim_id, 
				"class": 'span-2 border'}).appendTo (dropped_dim);

			comparison_sign.append(new Option("=", "="));
			
			$( "#comparison-selection-" + dropped_dim_id ).selectmenu ();

			//Add the selection for the attribute value
			var dimension = $(ui.draggable).attr ("pl-label").split(".")[0];
			var attribute = $(ui.draggable).attr ("pl-label").split(".")[1];
			
			self.getDimAttributeElements (dimension, attribute, function (filter_elements) {
			
				var filter_selection = $('<select>', 

					{"id": 'filter-selection-' + dropped_dim_id, "class": 'span-5 border', "dimension": dimension, "attribute": attribute}

				).appendTo (dropped_dim);	
				
				console.log ("getDimAttributeElements filter_elements = " + filter_elements);
			
				$.each (filter_elements,function (index,element) {

					console.log ("getDimAttributeElements filter_element = " + element);
					console.log ("getDimAttributeElements filter_selection = " + filter_selection.id);
					filter_selection.append (new Option(element, element));
				});
				
				$( "#filter-selection-" + dropped_dim_id ).selectmenu ({

					"change": function( event, data ) {

						console.log ("filter-selection-" + dropped_dim_id);
						console.log ("dim " + $(this).attr("dimension"));
						console.log ("attr " + $(this).attr("attribute"));
						console.log ("value " + $(this).val ());

						var selected_dimension = $(this).attr("dimension");
						var selected_attribute = $(this).attr("attribute");
						var selected_val = $(this).val ();

						$.each (self.currentFilters, function (idx, filter) {

							console.log ("filter " + JSON.stringify (filter));
							
							if ((filter.dimension == selected_dimension) && 
							    (filter.attribute == selected_attribute)) {

								filter.filterValue = selected_val;

							}
						});

						self.isQueryChanged = true;

						console.log ("changed");

					}
				});

				$( "#comparison-selection-" + dropped_dim_id ).selectmenu ({

					"change": function( event, data ) {

						console.log ("comparison: " + data.item.value);

						

						self.isQueryChanged = true;
					}
				});

				$( "#delbtn-filter-" + dropped_dim_id )
					  .button()
					  .click (function( event ) {
					
					console.log("$(this).id " + $(this).attr ("id"));
					
					//Remove the filter from the selection area
					var dropped_id = $(this).attr ("id").replace ("delbtn-filter-","");	

					$("#dropped-" + dropped_id).remove();

					//Show again the filter element in the original selection area
					$("#" + $(this).attr("id") + "_attribute_sel").toggle();
					
					$("#droppable-" + dropped_id).show();

					//Find the element in the currentFilters array:

					var index = $.map(self.currentFilters,
						function (element, index) { 
							if ((element.dimension == dimension) && (element.attribute == attribute))
								return index;
						}
					);

					if (index != -1) {
						
						self.currentFilters.splice(index, 1);
					} 

					self.isQueryChanged = true;
				});
				
				$(ui.draggable).hide();
				
				console.log ("dropTarget.id " + $(dropTarget).attr ("id"));
				
				var target_id = $(dropTarget).attr ("id");
				
				if (target_id == "pivot-selection-filters") {
					
					var comparisogn_sign = $( "#comparison-selection-" + dropped_dim_id ).val();
					var filter_selection = $( "#filter-selection-" + dropped_dim_id ).val();

					console.log ("filter.dimension " + dimension);
					console.log ("filter.attribute " + attribute);
					console.log ("filter.comparisogn " + comparisogn_sign);
					console.log ("filter.value " + filter_selection);
					
					self.currentFilters.push (
						{"dimension":dimension,
						"attribute":attribute,
						"comparison":comparisogn_sign,
						"filterValue":filter_selection});
					
					self.isQueryChanged = true;			
				}
			
			
			});
		}
	});
}

PlannificoPivot.prototype.field2id = function (field) {

	if (!field) return "";	

	return field.replace(";","PV").replace(".","P").replace(/ /g,"S").replace(/\//g,"SL");
}

