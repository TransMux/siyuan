// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package av

import (
	"sort"
	"time"

	"github.com/88250/lute/ast"
)

// LayoutCalendar 描述了日历布局的结构。
type LayoutCalendar struct {
	*BaseLayout

	DateFieldID    string           `json:"dateFieldId"`    // 日期字段ID，用于显示在日历上
	ViewType       CalendarViewType `json:"viewType"`       // 日历视图类型：月视图、周视图、日视图
	StartDate      int64            `json:"startDate"`      // 日历显示的开始日期（时间戳）
	ShowWeekend    bool             `json:"showWeekend"`    // 是否显示周末
	FirstDayOfWeek int              `json:"firstDayOfWeek"` // 一周的第一天 (0=Sunday, 1=Monday)

	EventFields []*ViewCalendarEventField `json:"fields"`   // 日历事件显示字段
	EventIDs    []string                  `json:"eventIds"` // 事件ID，用于自定义排序
}

func (layoutCalendar *LayoutCalendar) GetItemIDs() (ret []string) {
	return layoutCalendar.EventIDs
}

func NewLayoutCalendar() *LayoutCalendar {
	return &LayoutCalendar{
		BaseLayout: &BaseLayout{
			Spec:     0,
			ID:       ast.NewNodeID(),
			Filters:  []*ViewFilter{},
			Sorts:    []*ViewSort{},
			PageSize: CalendarViewDefaultPageSize,
		},
		ViewType:       CalendarViewTypeMonth,
		StartDate:      time.Now().Unix() * 1000, // 当前时间戳（毫秒）
		ShowWeekend:    true,
		FirstDayOfWeek: 1, // 默认从周一开始
	}
}

// CalendarViewType 描述了日历视图类型。
type CalendarViewType int

const (
	CalendarViewTypeMonth CalendarViewType = iota // 月视图
	CalendarViewTypeWeek                          // 周视图
	CalendarViewTypeDay                           // 日视图
)

// ViewCalendarEventField 描述了日历事件字段的结构。
type ViewCalendarEventField struct {
	ID string `json:"id"` // 字段 ID

	Hidden bool   `json:"hidden"`         // 是否隐藏
	Desc   string `json:"desc,omitempty"` // 字段描述
}

// Calendar 描述了日历实例的结构。
type Calendar struct {
	*BaseInstance

	DateFieldID    string           `json:"dateFieldId"`    // 日期字段ID
	ViewType       CalendarViewType `json:"viewType"`       // 日历视图类型
	StartDate      int64            `json:"startDate"`      // 日历显示的开始日期
	ShowWeekend    bool             `json:"showWeekend"`    // 是否显示周末
	FirstDayOfWeek int              `json:"firstDayOfWeek"` // 一周的第一天

	Fields     []*CalendarField `json:"fields"`     // 日历字段
	Events     []*CalendarEvent `json:"events"`     // 日历事件
	EventCount int              `json:"eventCount"` // 日历总事件数
}

// CalendarEvent 描述了日历实例事件的结构。
type CalendarEvent struct {
	ID        string                `json:"id"`        // 事件 ID
	Values    []*CalendarFieldValue `json:"values"`    // 事件字段值
	StartTime int64                 `json:"startTime"` // 事件开始时间
	EndTime   int64                 `json:"endTime"`   // 事件结束时间
	Title     string                `json:"title"`     // 事件标题
	AllDay    bool                  `json:"allDay"`    // 是否全天事件
}

// CalendarField 描述了日历实例事件字段的结构。
type CalendarField struct {
	*BaseInstanceField
}

// CalendarFieldValue 描述了日历实例字段值的结构。
type CalendarFieldValue struct {
	*BaseValue
}

func (event *CalendarEvent) GetID() string {
	return event.ID
}

func (event *CalendarEvent) GetBlockValue() (ret *Value) {
	for _, v := range event.Values {
		if KeyTypeBlock == v.ValueType {
			ret = v.Value
			break
		}
	}
	return
}

func (event *CalendarEvent) GetValues() (ret []*Value) {
	ret = []*Value{}
	for _, v := range event.Values {
		ret = append(ret, v.Value)
	}
	return
}

func (calendar *Calendar) GetItems() (ret []Item) {
	ret = []Item{}
	for _, event := range calendar.Events {
		ret = append(ret, event)
	}
	return
}

func (calendar *Calendar) SetItems(items []Item) {
	calendar.Events = []*CalendarEvent{}
	for _, item := range items {
		calendar.Events = append(calendar.Events, item.(*CalendarEvent))
	}
}

func (calendar *Calendar) GetType() LayoutType {
	return LayoutTypeCalendar
}

func (calendar *Calendar) GetID() string {
	return calendar.ID
}

func (calendar *Calendar) Sort(attrView *AttributeView) {
	if 1 > len(calendar.Sorts) {
		return
	}

	type FieldIndexSort struct {
		Index int
		Order SortOrder
	}

	var fieldIndexSorts []*FieldIndexSort
	for _, s := range calendar.Sorts {
		for i, c := range calendar.Fields {
			if c.ID == s.Column {
				fieldIndexSorts = append(fieldIndexSorts, &FieldIndexSort{Index: i, Order: s.Order})
				break
			}
		}
	}

	editedValEvents := map[string]bool{}
	for i, event := range calendar.Events {
		for _, fieldIndexSort := range fieldIndexSorts {
			val := calendar.Events[i].Values[fieldIndexSort.Index].Value
			if KeyTypeCheckbox == val.Type {
				if block := event.GetBlockValue(); nil != block && block.IsEdited() {
					editedValEvents[event.ID] = true
					break
				}
			}

			if val.IsEdited() {
				editedValEvents[event.ID] = true
				break
			}
		}
	}

	// 将未编辑的事件和已编辑的事件分开排序
	var uneditedEvents, editedEvents []*CalendarEvent
	for _, event := range calendar.Events {
		if _, ok := editedValEvents[event.ID]; ok {
			editedEvents = append(editedEvents, event)
		} else {
			uneditedEvents = append(uneditedEvents, event)
		}
	}

	// 未编辑的事件按创建时间排序
	sort.Slice(uneditedEvents, func(i, j int) bool {
		val1 := uneditedEvents[i].GetBlockValue()
		if nil == val1 {
			return true
		}
		val2 := uneditedEvents[j].GetBlockValue()
		if nil == val2 {
			return false
		}
		return val1.CreatedAt < val2.CreatedAt
	})

	// 已编辑的事件按指定规则排序
	sort.Slice(editedEvents, func(i, j int) bool {
		sorted := true
		for _, fieldIndexSort := range fieldIndexSorts {
			val1 := editedEvents[i].Values[fieldIndexSort.Index].Value
			val2 := editedEvents[j].Values[fieldIndexSort.Index].Value
			if nil == val1 || val1.IsEmpty() {
				if nil != val2 && !val2.IsEmpty() {
					return false
				}
				sorted = false
				continue
			} else {
				if nil == val2 || val2.IsEmpty() {
					return true
				}
			}

			result := val1.Compare(val2, attrView)
			if 0 == result {
				sorted = false
				continue
			}
			sorted = true

			if fieldIndexSort.Order == SortOrderAsc {
				return 0 > result
			}
			return 0 < result
		}

		if !sorted {
			// 如果没有自定义排序或排序结果相同，则按开始时间排序
			return editedEvents[i].StartTime < editedEvents[j].StartTime
		}
		return false
	})

	// 将已编辑的事件放在前面，未编辑的事件放在后面
	calendar.Events = append(editedEvents, uneditedEvents...)
	if 1 > len(calendar.Events) {
		calendar.Events = []*CalendarEvent{}
	}
}

func (calendar *Calendar) Filter(attrView *AttributeView) {
	if 1 > len(calendar.Filters) {
		return
	}

	var fieldIndexes []int
	for _, f := range calendar.Filters {
		for i, c := range calendar.Fields {
			if c.ID == f.Column {
				fieldIndexes = append(fieldIndexes, i)
				break
			}
		}
	}

	events := []*CalendarEvent{}
	attrViewCache := map[string]*AttributeView{}
	attrViewCache[attrView.ID] = attrView
	for _, event := range calendar.Events {
		pass := true
		for j, index := range fieldIndexes {
			operator := calendar.Filters[j].Operator

			if nil == event.Values[index].Value {
				if FilterOperatorIsNotEmpty == operator {
					pass = false
				} else if FilterOperatorIsEmpty == operator {
					pass = true
					break
				}

				if KeyTypeText != event.Values[index].ValueType {
					pass = false
				}
				break
			}

			if !event.Values[index].Value.Filter(calendar.Filters[j], attrView, event.ID, &attrViewCache) {
				pass = false
				break
			}
		}
		if pass {
			events = append(events, event)
		}
	}
	calendar.Events = events
}
