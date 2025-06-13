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
			removeMissingField(attrView, view, field.ID)
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
	for _, event := range eventsValues {
		if !event.Exist {
			continue
		}

		calendarEvent := &av.CalendarEvent{
			ID:     event.ID,
			Values: []*av.CalendarFieldValue{},
		}

		// Find date field to extract event time
		for _, value := range event.Values {
			if value.KeyID == ret.DateFieldID && value.Date != nil {
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
					ID:    ast.NewNodeID(),
					KeyID: field.ID,
					Type:  field.Type,
				},
			}

			for _, value := range event.Values {
				if value.KeyID == field.ID {
					fieldValue.BaseValue = &av.BaseValue{
						ID:         value.ID,
						KeyID:      value.KeyID,
						BlockID:    value.BlockID,
						Type:       value.Type,
						Text:       value.Text,
						Number:     value.Number,
						MSelect:    value.MSelect,
						MAsset:     value.MAsset,
						Block:      value.Block,
						URL:        value.URL,
						Phone:      value.Phone,
						Email:      value.Email,
						Template:   value.Template,
						Checkbox:   value.Checkbox,
						Relation:   value.Relation,
						Rollup:     value.Rollup,
						Date:       value.Date,
						Created:    value.Created,
						Updated:    value.Updated,
						IsDetached: value.IsDetached,
						CreatedAt:  value.CreatedAt,
						UpdatedAt:  value.UpdatedAt,
					}

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

func removeMissingField(attrView *av.AttributeView, view *av.View, fieldID string) {
	for i, field := range view.Calendar.EventFields {
		if field.ID == fieldID {
			view.Calendar.EventFields = append(view.Calendar.EventFields[:i], view.Calendar.EventFields[i+1:]...)
			break
		}
	}
}
