/*Copyright 2014 Rosario Alfano

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.*/

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
	
*/
function PlannificoPivot (i_container, i_configuration, i_on_change_query, i_get_dim_attribute_elements) {

	this.container = i_container;
	this.configuration = i_configuration;

	this.isQueryChanged = true;
	
	this.currentDimensionsCols = [];
	this.currentDimensionsRows = [];
	this.currentMeasures = [];
	this.currentFilters = [];
	
	if (i_on_change_query && (typeof i_on_change_query == "function")) {
		
		this.onChangeQuery = i_on_change_query;		
		
	} else 
		this.onChangeQuery = function (dr,dc,m,f,data) {console.log ("this.onChangeQuery not set");};
	
	if (i_get_dim_attribute_elements && (typeof i_get_dim_attribute_elements == "function")) {
		
		this.getDimAttributeElements = i_get_dim_attribute_elements;		
		
	} else 
		this.getDimAttributeElements = function (d,a) {console.log ("this.getDimAttributeElements not set"); return []};

}

/*
	Completely refresh the pivot container
*/
PlannificoPivot.prototype.refresh = function () {
	
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
	
	$ ("<div>", {
		
		"id": 'data-grid-container',
		"class": 'span-15'
			
	}).appendTo(data_area).html (
		"columns: " + this.currentDimensionsCols + 
		" rows: " + this.currentDimensionsRows + 
		" measures: " + this.currentMeasures);

	console.log ("this.isQueryChanged " + this.isQueryChanged);

	var self = this;

	if (this.isQueryChanged)
		this.onChangeQuery (
			this.currentDimensionsRows,
			this.currentDimensionsCols,
			this.currentMeasures,
			this.currentFilters,
			function (data) {

				console.log ("onDataReady()");
				
				//TODO
				var pivot_selection_header = $ ("<h3>", {

					"id": 'pivot-selection-header'
			
				}).appendTo (this.rightContainer);

				data = data.sort (function (row_1,row_2) {

					var sort_idx = 0;
					
					$.each (row_1, function (idx, field) {

						if (sort_idx != 0) return;

						if (field.measure) return;

						if (field.attribute != row_2 [idx].attribute) return;

						if (field.value > row_2 [idx].value) 
							sort_idx = 1;
						
						else if (field.value < row_2 [idx].value)
							sort_idx = -1;
						else
							sort_idx = 0;						
										
					});
					
					return sort_idx;
				});

				$.each (data, function (index, row) {

					$.each (row, function (index, field) {

						if (field.measure) console.log ("measure: " + field.value);
						
						if (self.currentDimensionsRows.indexOf(field.attribute) != -1) console.log ("row: " + field.value);
						if (self.currentDimensionsCols.indexOf(field.attribute) != -1) console.log ("column:"  + field.value);

						
					});					
				});
				
			}				
		);
	
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
				
				"id":  "droppable-" + dimension + "-" + attribute,
				"pl-label": dimension + "." + attribute,
				"class": 'small span-1 ' + additional_classes,
				"parent-id": dim_attribute_selection.attr("id")
				
			}).appendTo (dim_attribute_selection).html (attribute);
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

			"id": id_prefix + element,
			"class": 'span-2 border ui-widget-content' 
			
		}).appendTo (dims_container)
			.html (element);
	
	
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
			"parent-id":'measure-menu'
			
		}).appendTo (measures).html (element);		
		
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
			).appendTo (dropped_dim).html(attribute);
			
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
				"class": 'span-5'}
			).appendTo (dropped_m).html ($(ui.draggable).attr ("pl-label"));

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
				
				self.currentMeasures.push ($(ui.draggable).text());
				
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
			var dropped_dim_lb = $('<button>', 
				{
				"id": 'delbtn-filter-' + dropped_dim_id, 
				"class": 'span-5 border'}
			).appendTo (dropped_dim).html($(ui.draggable).attr ("pl-label"));
			
			//Add the selection for the comparison sign
			var comparison_sign = $('<select>', 
				{"id": 'comparison-selection-' + dropped_dim_id, 
				"class": 'span-2 border'}).appendTo (dropped_dim);

			comparison_sign.append(new Option("=", "="));
			
			$( "#comparison-selection-" + dropped_dim_id ).selectmenu ();

			//Add the selection for the attribute value
			var dimension = $(ui.draggable).attr ("pl-label").split(".")[0];
			var attribute = $(ui.draggable).attr ("pl-label").split(".")[1];
			
			var filter_selection = $('<select>', 

				{"id": 'filter-selection-' + dropped_dim_id, "class": 'span-5 border', "dimension": dimension, "attribute": attribute}

			).appendTo (dropped_dim);			

			var filter_elements = self.getDimAttributeElements (dimension, attribute);

			$.each (filter_elements,function (index,element) {

				filter_selection.append (new Option(element, element));
			});
			
			$( "#filter-selection-" + dropped_dim_id ).selectmenu ({

				"change": function( event, data ) {

					console.log ("filters " + data.item.value);
					console.log ("dim " + $(this).attr("dimension"));
					console.log ("attr " + $(this).attr("attribute"));

					self.isQueryChanged = true;
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
		}
	});

}


