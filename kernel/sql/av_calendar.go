package sql

import (
	"github.com/88250/lute/ast"
	"github.com/siyuan-note/siyuan/kernel/av"
)

func RenderAttributeViewCalendar(attrView *av.AttributeView, view *av.View, query string) (ret *av.Calendar) {
	ret = &av.Calendar{
		BaseInstance: &av.BaseInstance{
			ID:               view.ID,
			Icon:             view.Icon,
			Name:             view.Name,
			Desc:             view.Desc,
			HideAttrViewName: view.HideAttrViewName,
			Filters:          view.Calendar.Filters,
			Sorts:            view.Calendar.Sorts,
		},
		DateFieldID:    view.Calendar.DateFieldID,
		ViewType:       view.Calendar.ViewType,
		StartDate:      view.Calendar.StartDate,
		ShowWeekend:    view.Calendar.ShowWeekend,
		FirstDayOfWeek: view.Calendar.FirstDayOfWeek,
		Fields:         []*av.CalendarField{},
		Events:         []*av.CalendarEvent{},
	}

	// Set default date field if not set
	if ret.DateFieldID == "" {
		for _, kv := range attrView.KeyValues {
			if kv.Key.Type == av.KeyTypeDate {
				ret.DateFieldID = kv.Key.ID
				view.Calendar.DateFieldID = kv.Key.ID
				break
			}
		}
	}

	// 组装字段
	for _, field := range view.Calendar.EventFields {
		key, getErr := attrView.GetKey(field.ID)
		if nil != getErr {
			// 找不到字段则在视图中删除
			removeMissingCalendarField(attrView, view, field.ID)
			continue
		}

		ret.Fields = append(ret.Fields, &av.CalendarField{
			BaseInstanceField: &av.BaseInstanceField{
				ID:           key.ID,
				Name:         key.Name,
				Type:         key.Type,
				Icon:         key.Icon,
				Hidden:       field.Hidden,
				Desc:         key.Desc,
				Options:      key.Options,
				NumberFormat: key.NumberFormat,
				Template:     key.Template,
				Relation:     key.Relation,
				Rollup:       key.Rollup,
				Date:         key.Date,
			},
		})
	}

	eventsValues := generateAttrViewItems(attrView) // 生成事件
	filterNotFoundAttrViewItems(&eventsValues)      // 过滤掉不存在的事件

	// 生成事件字段值
	for blockID, keyValues := range eventsValues {
		// Check if block exists
		blockValue := getBlockValue(keyValues)
		if nil == blockValue {
			continue
		}

		calendarEvent := &av.CalendarEvent{
			ID:     blockID,
			Values: []*av.CalendarFieldValue{},
		}

		// Find date field to extract event time
		for _, kv := range keyValues {
			if kv.Key.ID == ret.DateFieldID && len(kv.Values) > 0 && kv.Values[0].Date != nil {
				value := kv.Values[0]
				calendarEvent.StartTime = value.Date.Content
				if value.Date.HasEndDate {
					calendarEvent.EndTime = value.Date.Content2
				} else {
					calendarEvent.EndTime = value.Date.Content
				}
				calendarEvent.AllDay = value.Date.IsNotTime
			}
		}

		// 生成事件的字段值
		for _, field := range ret.Fields {
			fieldValue := &av.CalendarFieldValue{
				BaseValue: &av.BaseValue{
					ID:        ast.NewNodeID(),
					ValueType: field.Type,
					Value:     nil,
				},
			}

			for _, kv := range keyValues {
				if kv.Key.ID == field.ID && len(kv.Values) > 0 {
					value := kv.Values[0]
					fieldValue.BaseValue.ID = value.ID
					fieldValue.BaseValue.ValueType = value.Type
					fieldValue.BaseValue.Value = value

					// Extract title from first text field
					if field.Type == av.KeyTypeText && calendarEvent.Title == "" && value.Text != nil {
						calendarEvent.Title = value.Text.Content
					}
					break
				}
			}

			calendarEvent.Values = append(calendarEvent.Values, fieldValue)
		}

		// Set default title if not found
		if calendarEvent.Title == "" {
			calendarEvent.Title = "Untitled Event"
		}

		ret.Events = append(ret.Events, calendarEvent)
	}

	return
}

func removeMissingCalendarField(attrView *av.AttributeView, view *av.View, fieldID string) {
	for i, field := range view.Calendar.EventFields {
		if field.ID == fieldID {
			view.Calendar.EventFields = append(view.Calendar.EventFields[:i], view.Calendar.EventFields[i+1:]...)
			break
		}
	}
}
